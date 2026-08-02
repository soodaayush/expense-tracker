// One-off schema runner. Same script/env vars point at the local Docker SQL Server
// and at the real Azure SQL Database — run manually (`npm run db:migrate`), never
// wired into CI, since automatic unreviewed DDL execution on every push is riskier
// than the convenience is worth at this scale.
const fs = require("node:fs");
const path = require("node:path");
const sql = require("mssql");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const DB_NAME_RE = /^[A-Za-z0-9_-]+$/;

async function main() {
  const server = requireEnv("SQL_SERVER");
  const port = Number(process.env.SQL_PORT ?? 1433);
  const database = requireEnv("SQL_DATABASE");
  const user = requireEnv("SQL_USER");
  const password = requireEnv("SQL_PASSWORD");
  const trustServerCertificate = process.env.SQL_TRUST_SERVER_CERT === "true";

  if (!DB_NAME_RE.test(database)) {
    throw new Error(`SQL_DATABASE "${database}" has unexpected characters — refusing to interpolate into DDL`);
  }

  const baseConfig = {
    server,
    port,
    user,
    password,
    options: { encrypt: true, trustServerCertificate },
    connectionTimeout: 30000,
    requestTimeout: 30000,
  };

  console.log(`Ensuring database "${database}" exists on ${server}:${port}...`);
  const masterPool = await sql.connect({ ...baseConfig, database: "master" });
  try {
    // Azure SQL Database requires CREATE DATABASE to be the only statement in its batch,
    // so an `IF DB_ID(...) IS NULL` guard around it isn't reliably enforced there — instead
    // just attempt creation unconditionally and treat "already exists" as success.
    await masterPool.request().batch(`CREATE DATABASE [${database}];`);
  } catch (err) {
    if (err.number !== 1801) throw err;
  }
  await masterPool.close();

  console.log(`Applying schema to "${database}"...`);
  const pool = await sql.connect({ ...baseConfig, database });
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaText = fs.readFileSync(schemaPath, "utf8");
  const batches = schemaText.split(/^\s*GO\s*$/m).map((b) => b.trim()).filter(Boolean);

  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  await pool.close();

  console.log(`Schema applied (${batches.length} batches).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
