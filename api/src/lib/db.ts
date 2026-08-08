import sql, { ConnectionPool } from "mssql";
import { randomUUID } from "node:crypto";
import { Bill, BillInput, BillPatch, Payee, PaymentMethod } from "../shared/types";

export class NotFoundError extends Error {
  statusCode = 404;
}

export class ConflictError extends Error {
  statusCode = 409;
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
    // Azure SQL serverless auto-pauses on inactivity; the first connection after a pause can
    // take up to ~a minute to resume. 30s was shorter than that, so the very first request
    // after a pause would hard-fail with a connection timeout instead of just being slow.
    connectionTimeout: 120000,
    requestTimeout: 120000,
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

// Reads payee_id/payee_name from a JOIN with Payees rather than Bills.payee (the legacy,
// no-longer-authoritative string column — see the migration comment in schema.sql) so a bill's
// displayed payee always reflects the payee's current name, even after a rename.
function toBill(row: Record<string, unknown>): Bill {
  return {
    id: row.id as string,
    payeeId: row.payee_id as string,
    payee: row.payee_name as string,
    paymentMethodId: (row.payment_method_id as string | null) ?? null,
    paymentMethod: (row.payment_method_name as string | null) ?? null,
    amount: row.amount === null ? null : Number(row.amount),
    dueDate: formatDateOnly(row.due_date as Date),
    paidDate: row.paid_date === null ? null : formatDateOnly(row.paid_date as Date),
    notes: row.notes as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// LEFT JOINed since payment_method_id is nullable (unlike payee_id) — a bill with no payment
// method assigned should still come back, just with paymentMethod: null.
const BILL_SELECT = `
  SELECT b.id, b.payee_id, p.name AS payee_name, b.payment_method_id, pm.name AS payment_method_name,
         b.amount, b.due_date, b.paid_date, b.notes, b.created_at, b.updated_at
  FROM dbo.Bills b
  JOIN dbo.Payees p ON p.id = b.payee_id
  LEFT JOIN dbo.PaymentMethods pm ON pm.id = b.payment_method_id
`;

async function getBillById(userId: string, id: string): Promise<Bill> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`${BILL_SELECT} WHERE b.id = @id AND b.user_id = @userId`);
  if (result.recordset.length === 0) throw new NotFoundError("bill_not_found");
  return toBill(result.recordset[0]);
}

export async function listBills(userId: string): Promise<Bill[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`${BILL_SELECT} WHERE b.user_id = @userId ORDER BY b.due_date DESC, b.created_at DESC`);
  return result.recordset.map(toBill);
}

export async function createBill(userId: string, input: BillInput): Promise<Bill> {
  const pool = await getPool();
  const id = randomUUID();
  const payee = await findOrCreatePayeeId(userId, input.payee);
  const paymentMethodId = input.paymentMethod
    ? (await findOrCreatePaymentMethodId(userId, input.paymentMethod)).id
    : null;
  await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("payeeId", sql.UniqueIdentifier, payee.id)
    .input("payee", sql.NVarChar(400), payee.name)
    .input("paymentMethodId", sql.UniqueIdentifier, paymentMethodId)
    .input("amount", sql.Decimal(12, 2), input.amount)
    .input("dueDate", sql.Date, parseDateOnly(input.dueDate))
    .input("paidDate", sql.Date, input.paidDate ? parseDateOnly(input.paidDate) : null)
    .input("notes", sql.NVarChar(sql.MAX), input.notes ?? "")
    .query(
      `INSERT INTO dbo.Bills (id, user_id, payee_id, payee, payment_method_id, amount, due_date, paid_date, notes)
       VALUES (@id, @userId, @payeeId, @payee, @paymentMethodId, @amount, @dueDate, @paidDate, @notes)`
    );
  return getBillById(userId, id);
}

// Bulk path for CSV import: one bulk-copy round-trip per table instead of one INSERT per row,
// wrapped in a transaction so a chunk either fully lands or fully rolls back (safe to retry).
export async function bulkCreateBills(userId: string, rows: BillInput[]): Promise<{ inserted: number }> {
  if (rows.length === 0) return { inserted: 0 };

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // Keyed by lowercased name to match the DB's case-insensitive collation — a plain JS Set
    // would let e.g. "Verizon" and "VERIZON" in the same chunk both look distinct, one of which
    // would then collide with the other on insert and abort the whole chunk's bulk copy.
    const nameByKey = new Map<string, string>();
    for (const row of rows) {
      const trimmed = row.payee.trim();
      const key = trimmed.toLowerCase();
      if (!nameByKey.has(key)) nameByKey.set(key, trimmed);
    }

    const idByKey = new Map<string, string>();
    if (nameByKey.size > 0) {
      const names = [...nameByKey.values()];
      const existingRequest = new sql.Request(transaction).input("userId", sql.UniqueIdentifier, userId);
      names.forEach((name, i) => existingRequest.input(`p${i}`, sql.NVarChar(400), name));
      const existing = await existingRequest.query(
        `SELECT id, name FROM dbo.Payees WHERE user_id = @userId AND name IN (${names
          .map((_, i) => `@p${i}`)
          .join(", ")})`
      );
      for (const r of existing.recordset) idByKey.set((r.name as string).toLowerCase(), r.id as string);

      const newKeys = [...nameByKey.keys()].filter((key) => !idByKey.has(key));
      if (newKeys.length > 0) {
        const payeeTable = new sql.Table("dbo.Payees");
        payeeTable.create = false;
        payeeTable.columns.add("id", sql.UniqueIdentifier, { nullable: false });
        payeeTable.columns.add("user_id", sql.UniqueIdentifier, { nullable: false });
        payeeTable.columns.add("name", sql.NVarChar(400), { nullable: false });
        for (const key of newKeys) {
          const id = randomUUID();
          payeeTable.rows.add(id, userId, nameByKey.get(key));
          idByKey.set(key, id);
        }
        await new sql.Request(transaction).bulk(payeeTable);
      }
    }

    const billsTable = new sql.Table("dbo.Bills");
    billsTable.create = false;
    billsTable.columns.add("id", sql.UniqueIdentifier, { nullable: false });
    billsTable.columns.add("user_id", sql.UniqueIdentifier, { nullable: false });
    billsTable.columns.add("payee_id", sql.UniqueIdentifier, { nullable: false });
    billsTable.columns.add("payee", sql.NVarChar(400), { nullable: false });
    billsTable.columns.add("amount", sql.Decimal(12, 2), { nullable: true });
    billsTable.columns.add("due_date", sql.Date, { nullable: false });
    billsTable.columns.add("paid_date", sql.Date, { nullable: true });
    billsTable.columns.add("notes", sql.NVarChar(sql.MAX), { nullable: false });
    for (const row of rows) {
      const trimmed = row.payee.trim();
      const payeeId = idByKey.get(trimmed.toLowerCase())!;
      billsTable.rows.add(
        randomUUID(),
        userId,
        payeeId,
        trimmed,
        row.amount,
        parseDateOnly(row.dueDate),
        row.paidDate ? parseDateOnly(row.paidDate) : null,
        row.notes ?? ""
      );
    }
    await new sql.Request(transaction).bulk(billsTable);

    await transaction.commit();
    return { inserted: rows.length };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function updateBill(userId: string, id: string, patch: BillPatch): Promise<Bill> {
  const pool = await getPool();
  const request = pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .input("updatedAt", sql.DateTime2, new Date());

  const setClauses: string[] = ["updated_at = @updatedAt"];
  if ("payee" in patch && patch.payee) {
    const payee = await findOrCreatePayeeId(userId, patch.payee);
    setClauses.push("payee_id = @payeeId", "payee = @payee");
    request.input("payeeId", sql.UniqueIdentifier, payee.id);
    request.input("payee", sql.NVarChar(400), payee.name);
  }
  if ("paymentMethod" in patch) {
    const paymentMethodId = patch.paymentMethod
      ? (await findOrCreatePaymentMethodId(userId, patch.paymentMethod)).id
      : null;
    setClauses.push("payment_method_id = @paymentMethodId");
    request.input("paymentMethodId", sql.UniqueIdentifier, paymentMethodId);
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
    `UPDATE dbo.Bills SET ${setClauses.join(", ")} OUTPUT INSERTED.id WHERE id = @id AND user_id = @userId`
  );
  if (result.recordset.length === 0) throw new NotFoundError("bill_not_found");
  return getBillById(userId, id);
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
// Payees is now the source of truth for a payee's identity (id), not just a denormalized
// autocomplete list — Bills.payee_id references it, so a rename here is visible on every bill
// that uses it. The UNIQUE (user_id, name) constraint, under the database's default
// case-insensitive collation, gives per-user case-insensitive dedup for free.

const UNIQUE_VIOLATION_ERROR_NUMBERS = new Set([2627, 2601]);
const FK_VIOLATION_ERROR_NUMBER = 547;

function isUniqueViolation(err: unknown): boolean {
  const number = (err as { number?: number })?.number;
  return typeof number === "number" && UNIQUE_VIOLATION_ERROR_NUMBERS.has(number);
}

function isForeignKeyViolation(err: unknown): boolean {
  return (err as { number?: number })?.number === FK_VIOLATION_ERROR_NUMBER;
}

export async function listPayees(userId: string): Promise<Payee[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT id, name FROM dbo.Payees WHERE user_id = @userId ORDER BY name");
  return result.recordset.map((row) => ({ id: row.id as string, name: row.name as string }));
}

// Resolves a payee by name for a user, creating it if it doesn't exist yet — this must run
// before a Bills insert now, since payee_id is a required NOT NULL foreign key rather than a
// fire-and-forget side effect the way the old denormalized Payees list was.
export async function findOrCreatePayeeId(userId: string, rawName: string): Promise<Payee> {
  const name = rawName.trim();
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("name", sql.NVarChar(400), name)
    .query("SELECT id, name FROM dbo.Payees WHERE user_id = @userId AND name = @name");
  if (existing.recordset[0]) {
    return { id: existing.recordset[0].id, name: existing.recordset[0].name };
  }

  const id = randomUUID();
  try {
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(400), name)
      .query("INSERT INTO dbo.Payees (id, user_id, name) VALUES (@id, @userId, @name)");
    return { id, name };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Lost a race to a concurrent insert of the same (user_id, name) — the winner already exists.
    const retry = await pool
      .request()
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(400), name)
      .query("SELECT id, name FROM dbo.Payees WHERE user_id = @userId AND name = @name");
    if (!retry.recordset[0]) throw err;
    return { id: retry.recordset[0].id, name: retry.recordset[0].name };
  }
}

export async function ensurePayeeKnown(userId: string, name: string): Promise<void> {
  if (!name.trim()) return;
  await findOrCreatePayeeId(userId, name);
}

export async function updatePayee(userId: string, payeeId: string, newName: string): Promise<Payee> {
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, payeeId)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(400), newName)
      .query(
        "UPDATE dbo.Payees SET name = @name OUTPUT INSERTED.id, INSERTED.name WHERE id = @id AND user_id = @userId"
      );
    if (result.recordset.length === 0) throw new NotFoundError("payee_not_found");
    return { id: result.recordset[0].id, name: result.recordset[0].name };
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError("A payee with that name already exists");
    throw err;
  }
}

export async function deletePayee(userId: string, payeeId: string): Promise<void> {
  const pool = await getPool();
  const countResult = await pool
    .request()
    .input("id", sql.UniqueIdentifier, payeeId)
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT COUNT(*) AS billCount FROM dbo.Bills WHERE payee_id = @id AND user_id = @userId");
  const billCount = countResult.recordset[0].billCount as number;
  if (billCount > 0) {
    throw new ConflictError(`This payee is used by ${billCount} bill${billCount === 1 ? "" : "s"} and can't be deleted`);
  }

  try {
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, payeeId)
      .input("userId", sql.UniqueIdentifier, userId)
      .query("DELETE FROM dbo.Payees WHERE id = @id AND user_id = @userId");
    if (result.rowsAffected[0] === 0) throw new NotFoundError("payee_not_found");
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      // Closes the race between the count check above and this delete: a bill attached to this
      // payee in between is caught here by the real FK constraint (schema.sql's ON DELETE
      // NO ACTION), not just the app-level check.
      throw new ConflictError("This payee is now used by one or more bills and can't be deleted");
    }
    throw err;
  }
}

// --- Payment Methods ---
// Same shape as Payees, but the FK on Bills is nullable (a bill needn't have a payment method
// assigned), so there's no findOrCreate-before-insert requirement and no legacy denormalized
// column to migrate off of.

export async function listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT id, name FROM dbo.PaymentMethods WHERE user_id = @userId ORDER BY name");
  return result.recordset.map((row) => ({ id: row.id as string, name: row.name as string }));
}

export async function findOrCreatePaymentMethodId(userId: string, rawName: string): Promise<PaymentMethod> {
  const name = rawName.trim();
  const pool = await getPool();

  const existing = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("name", sql.NVarChar(200), name)
    .query("SELECT id, name FROM dbo.PaymentMethods WHERE user_id = @userId AND name = @name");
  if (existing.recordset[0]) {
    return { id: existing.recordset[0].id, name: existing.recordset[0].name };
  }

  const id = randomUUID();
  try {
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(200), name)
      .query("INSERT INTO dbo.PaymentMethods (id, user_id, name) VALUES (@id, @userId, @name)");
    return { id, name };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Lost a race to a concurrent insert of the same (user_id, name) — the winner already exists.
    const retry = await pool
      .request()
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(200), name)
      .query("SELECT id, name FROM dbo.PaymentMethods WHERE user_id = @userId AND name = @name");
    if (!retry.recordset[0]) throw err;
    return { id: retry.recordset[0].id, name: retry.recordset[0].name };
  }
}

export async function ensurePaymentMethodKnown(userId: string, name: string): Promise<void> {
  if (!name.trim()) return;
  await findOrCreatePaymentMethodId(userId, name);
}

export async function updatePaymentMethod(userId: string, id: string, newName: string): Promise<PaymentMethod> {
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(200), newName)
      .query(
        "UPDATE dbo.PaymentMethods SET name = @name OUTPUT INSERTED.id, INSERTED.name WHERE id = @id AND user_id = @userId"
      );
    if (result.recordset.length === 0) throw new NotFoundError("payment_method_not_found");
    return { id: result.recordset[0].id, name: result.recordset[0].name };
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError("A payment method with that name already exists");
    throw err;
  }
}

export async function deletePaymentMethod(userId: string, id: string): Promise<void> {
  const pool = await getPool();
  const countResult = await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .input("userId", sql.UniqueIdentifier, userId)
    .query("SELECT COUNT(*) AS billCount FROM dbo.Bills WHERE payment_method_id = @id AND user_id = @userId");
  const billCount = countResult.recordset[0].billCount as number;
  if (billCount > 0) {
    throw new ConflictError(
      `This payment method is used by ${billCount} bill${billCount === 1 ? "" : "s"} and can't be deleted`
    );
  }

  try {
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("userId", sql.UniqueIdentifier, userId)
      .query("DELETE FROM dbo.PaymentMethods WHERE id = @id AND user_id = @userId");
    if (result.rowsAffected[0] === 0) throw new NotFoundError("payment_method_not_found");
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      // Closes the race between the count check above and this delete, same as deletePayee.
      throw new ConflictError("This payment method is now used by one or more bills and can't be deleted");
    }
    throw err;
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
