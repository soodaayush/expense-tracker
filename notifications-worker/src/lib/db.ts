import sql, { ConnectionPool } from "mssql";
import { Bill, NotificationPreferences } from "../shared/types";

// Same connection setup as api/src/lib/db.ts — kept as a local copy since this project deploys
// as a separate Function App (see notificationsSend.ts) and isn't bundled together with api/.

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

// Dates round-trip as "YYYY-MM-DD" strings; SQL's DATE columns have no time component, so
// constructing/reading at UTC midnight is safe and stable.
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

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

// LEFT JOINed since payment_method_id is nullable — a bill with no payment method assigned
// should still come back, just with paymentMethod: null.
const BILL_SELECT = `
  SELECT b.id, b.payee_id, p.name AS payee_name, b.payment_method_id, pm.name AS payment_method_name,
         b.amount, b.due_date, b.paid_date, b.notes, b.created_at, b.updated_at
  FROM dbo.Bills b
  JOIN dbo.Payees p ON p.id = b.payee_id
  LEFT JOIN dbo.PaymentMethods pm ON pm.id = b.payment_method_id
`;

// --- Notification sending ---
// These iterate across every user rather than a single session-derived userId, since there's no
// HTTP session driving a background job — but each step below still scopes its own bill
// reads/writes to that one user's id, preserving the same per-account isolation as everywhere else.

export interface NotificationPreferencesRow extends NotificationPreferences {
  userId: string;
  lastSentLocalDate: string | null;
}

export async function listEnabledNotificationPreferences(): Promise<NotificationPreferencesRow[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(
      `SELECT user_id, email, enabled, lead_days, send_hour, send_minute, time_zone, last_sent_local_date
       FROM dbo.NotificationPreferences
       WHERE enabled = 1 AND email IS NOT NULL`
    );
  return result.recordset.map((row) => ({
    userId: row.user_id,
    email: row.email,
    enabled: !!row.enabled,
    leadDays: row.lead_days,
    sendHour: row.send_hour,
    sendMinute: row.send_minute,
    timeZone: row.time_zone,
    lastSentLocalDate: row.last_sent_local_date ? formatDateOnly(row.last_sent_local_date as Date) : null,
  }));
}

// A bill overdue by more than this is treated as "too stale to bother mentioning" rather than
// "still coming due" — without a floor here, due_date <= today + leadDays has no lower bound at
// all, so a bill from years ago qualifies exactly as well as one due tomorrow.
const MAX_OVERDUE_DAYS = 30;

// Unpaid bills due within leadDays (and not more than MAX_OVERDUE_DAYS past due) that haven't
// been reminded about yet — the exact set a digest email needs. Reuses BILL_SELECT so the email
// can show payee/payment-method names.
export async function findBillsNeedingReminder(userId: string, leadDays: number): Promise<Bill[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("leadDays", sql.Int, leadDays)
    .input("maxOverdueDays", sql.Int, MAX_OVERDUE_DAYS)
    .query(
      `${BILL_SELECT}
       WHERE b.user_id = @userId
         AND b.paid_date IS NULL
         AND b.reminder_sent_at IS NULL
         AND b.due_date <= DATEADD(day, @leadDays, CAST(SYSUTCDATETIME() AS DATE))
         AND b.due_date >= DATEADD(day, -@maxOverdueDays, CAST(SYSUTCDATETIME() AS DATE))
       ORDER BY b.due_date ASC`
    );
  return result.recordset.map(toBill);
}

export async function markBillsReminded(userId: string, billIds: string[]): Promise<void> {
  if (billIds.length === 0) return;
  const pool = await getPool();
  const request = pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("remindedAt", sql.DateTime2, new Date());
  billIds.forEach((id, i) => request.input(`id${i}`, sql.UniqueIdentifier, id));
  await request.query(
    `UPDATE dbo.Bills SET reminder_sent_at = @remindedAt
     WHERE user_id = @userId AND id IN (${billIds.map((_, i) => `@id${i}`).join(", ")})`
  );
}

// Stamps "checked today" regardless of whether a bill actually qualified, so a quiet day (no
// bills due soon) doesn't leave this user re-queried on every 15-minute tick for the rest of
// their send window.
export async function markNotificationCheckDone(userId: string, localDate: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("userId", sql.UniqueIdentifier, userId)
    .input("localDate", sql.Date, parseDateOnly(localDate))
    .query("UPDATE dbo.NotificationPreferences SET last_sent_local_date = @localDate WHERE user_id = @userId");
}
