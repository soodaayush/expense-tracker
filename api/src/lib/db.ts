import sql, { ConnectionPool } from "mssql";
import { randomUUID } from "node:crypto";
import { Bill, BillInput, BillPatch } from "../shared/types";

export class NotFoundError extends Error {
  statusCode = 404;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function buildConfig(): sql.config {
  return {
    server: requireEnv("SQL_SERVER"),
    port: Number(process.env.SQL_PORT ?? 1433),
    database: requireEnv("SQL_DATABASE"),
    user: requireEnv("SQL_USER"),
    password: requireEnv("SQL_PASSWORD"),
    options: {
      encrypt: true,
      trustServerCertificate: process.env.SQL_TRUST_SERVER_CERT === "true",
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 30000,
    requestTimeout: 30000,
  };
}

let poolPromise: Promise<ConnectionPool> | null = null;

export function getPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(buildConfig());
    pool.on("error", (err) => console.error("mssql pool error", err));
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

// Dates round-trip as "YYYY-MM-DD" strings at the API boundary; SQL's DATE columns
// have no time component, so constructing/reading at UTC midnight is safe and stable.
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// --- Users ---

export interface UserRecord {
  userId: string;
  displayName?: string;
  createdAt: string;
}

export async function createUser(userId: string, displayName?: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("displayName", sql.NVarChar(200), displayName?.trim() || null)
    .query("INSERT INTO dbo.Users (user_id, display_name) VALUES (@userId, @displayName)");
}

export async function getUser(userId: string): Promise<UserRecord | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT user_id, display_name, created_at FROM dbo.Users WHERE user_id = @userId");
  const row = result.recordset[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name ?? undefined,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// --- Bills ---
// Every query here must be scoped to userId sourced only from the signed session — that's
// the actual multi-tenant isolation boundary (mirrors the old Table Storage partition rule).

function toBill(row: Record<string, unknown>): Bill {
  return {
    id: row.id as string,
    payee: row.payee as string,
    amount: row.amount === null ? null : Number(row.amount),
    dueDate: formatDateOnly(row.due_date as Date),
    paidDate: row.paid_date === null ? null : formatDateOnly(row.paid_date as Date),
    notes: row.notes as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function listBills(userId: string): Promise<Bill[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT * FROM dbo.Bills WHERE user_id = @userId ORDER BY due_date DESC, created_at DESC");
  return result.recordset.map(toBill);
}

export async function createBill(userId: string, input: BillInput): Promise<Bill> {
  const pool = await getPool();
  const id = randomUUID();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("payee", sql.NVarChar(400), input.payee)
    .input("amount", sql.Decimal(12, 2), input.amount)
    .input("dueDate", sql.Date, parseDateOnly(input.dueDate))
    .input("paidDate", sql.Date, input.paidDate ? parseDateOnly(input.paidDate) : null)
    .input("notes", sql.NVarChar(sql.MAX), input.notes ?? "")
    .query(
      `INSERT INTO dbo.Bills (id, user_id, payee, amount, due_date, paid_date, notes)
       OUTPUT INSERTED.*
       VALUES (@id, @userId, @payee, @amount, @dueDate, @paidDate, @notes)`
    );
  await ensurePayeeKnown(userId, input.payee);
  return toBill(result.recordset[0]);
}

export async function updateBill(userId: string, id: string, patch: BillPatch): Promise<Bill> {
  const pool = await getPool();
  const request = pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("updatedAt", sql.DateTime2, new Date());

  const setClauses: string[] = ["updated_at = @updatedAt"];
  if ("payee" in patch) {
    setClauses.push("payee = @payee");
    request.input("payee", sql.NVarChar(400), patch.payee);
  }
  if ("dueDate" in patch) {
    setClauses.push("due_date = @dueDate");
    request.input("dueDate", sql.Date, patch.dueDate ? parseDateOnly(patch.dueDate) : null);
  }
  if ("amount" in patch) {
    setClauses.push("amount = @amount");
    request.input("amount", sql.Decimal(12, 2), patch.amount);
  }
  if ("paidDate" in patch) {
    setClauses.push("paid_date = @paidDate");
    request.input("paidDate", sql.Date, patch.paidDate ? parseDateOnly(patch.paidDate) : null);
  }
  if ("notes" in patch) {
    setClauses.push("notes = @notes");
    request.input("notes", sql.NVarChar(sql.MAX), patch.notes);
  }

  const result = await request.query(
    `UPDATE dbo.Bills SET ${setClauses.join(", ")} OUTPUT INSERTED.* WHERE id = @id AND user_id = @userId`
  );
  if (result.recordset.length === 0) throw new NotFoundError("bill_not_found");
  if (patch.payee) await ensurePayeeKnown(userId, patch.payee);
  return toBill(result.recordset[0]);
}

export async function deleteBill(userId: string, id: string): Promise<void> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .query("DELETE FROM dbo.Bills WHERE id = @id AND user_id = @userId");
  if (result.rowsAffected[0] === 0) throw new NotFoundError("bill_not_found");
}

// --- Payees ---
// Composite PK (user_id, name) under the database's default case-insensitive collation
// gives per-user, case-insensitive dedup for free — no separate slug/normalization needed.

const PK_VIOLATION_ERROR_NUMBERS = new Set([2627, 2601]);

function isPrimaryKeyViolation(err: unknown): boolean {
  const number = (err as { number?: number })?.number;
  return typeof number === "number" && PK_VIOLATION_ERROR_NUMBERS.has(number);
}

export async function listPayees(userId: string): Promise<string[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT name FROM dbo.Payees WHERE user_id = @userId ORDER BY name");
  return result.recordset.map((row) => row.name as string);
}

export async function ensurePayeeKnown(userId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const pool = await getPool();
  try {
    await pool
      .request()
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(400), trimmed)
      .query("INSERT INTO dbo.Payees (user_id, name) VALUES (@userId, @name)");
  } catch (err) {
    if (!isPrimaryKeyViolation(err)) throw err;
  }
}

// --- Credentials ---
// Stays globally keyed by credential_id: WebAuthn's discoverable-credential login gives us
// the credential ID before we know who the user is, so this needs to stay an O(1) lookup.

export interface CredentialRecord {
  credentialId: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceLabel: string;
  createdAt: string;
}

function toCredential(row: Record<string, unknown>): CredentialRecord {
  return {
    credentialId: row.credential_id as string,
    userId: row.user_id as string,
    publicKey: row.public_key as string,
    counter: row.counter as number,
    transports: row.transports ? JSON.parse(row.transports as string) : undefined,
    deviceLabel: row.device_label as string,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getCredential(credentialId: string): Promise<CredentialRecord | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("credentialId", sql.VarChar(500), credentialId)
    .query("SELECT * FROM dbo.Credentials WHERE credential_id = @credentialId");
  const row = result.recordset[0];
  return row ? toCredential(row) : null;
}

export async function createCredential(record: CredentialRecord): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("credentialId", sql.VarChar(500), record.credentialId)
    .input("userId", sql.UniqueIdentifier, record.userId)
    .input("publicKey", sql.VarChar(1000), record.publicKey)
    .input("counter", sql.Int, record.counter)
    .input("transports", sql.NVarChar(200), record.transports?.length ? JSON.stringify(record.transports) : null)
    .input("deviceLabel", sql.NVarChar(200), record.deviceLabel)
    .query(
      `INSERT INTO dbo.Credentials (credential_id, user_id, public_key, counter, transports, device_label)
       VALUES (@credentialId, @userId, @publicKey, @counter, @transports, @deviceLabel)`
    );
}

export async function updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("credentialId", sql.VarChar(500), credentialId)
    .input("counter", sql.Int, counter)
    .query("UPDATE dbo.Credentials SET counter = @counter WHERE credential_id = @credentialId");
}

// Not indexed by user_id as a lookup key beyond the IX_Credentials_UserId index — only used
// to build WebAuthn's excludeCredentials when adding a device.
export async function listCredentialsForUser(userId: string): Promise<CredentialRecord[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT * FROM dbo.Credentials WHERE user_id = @userId");
  return result.recordset.map(toCredential);
}
