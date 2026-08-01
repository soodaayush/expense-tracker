import { BillPatch, ImportRowInput } from "../shared/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RowValidation = { ok: true; row: ImportRowInput } | { ok: false; message: string };

export function validateImportRow(raw: unknown): RowValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "row is not an object" };
  }
  const row = raw as Record<string, unknown>;

  const payee = typeof row.payee === "string" ? row.payee.trim() : "";
  if (!payee) return { ok: false, message: "payee is required" };

  const dueDate = typeof row.dueDate === "string" ? row.dueDate.trim() : "";
  if (!DATE_RE.test(dueDate)) return { ok: false, message: "dueDate must be YYYY-MM-DD" };

  let amount: number | null = null;
  if (row.amount !== null && row.amount !== undefined && row.amount !== "") {
    const parsed = typeof row.amount === "number" ? row.amount : Number(row.amount);
    if (!Number.isFinite(parsed)) return { ok: false, message: "amount is not a valid number" };
    amount = parsed;
  }

  let paidDate: string | null = null;
  if (row.paidDate !== null && row.paidDate !== undefined && row.paidDate !== "") {
    const value = String(row.paidDate).trim();
    if (!DATE_RE.test(value)) return { ok: false, message: "paidDate must be YYYY-MM-DD" };
    paidDate = value;
  }

  const notes = typeof row.notes === "string" ? row.notes : "";

  return { ok: true, row: { payee, amount, dueDate, paidDate, notes } };
}

export type PatchValidation = { ok: true; patch: BillPatch } | { ok: false; message: string };

export function validateBillPatch(raw: unknown): PatchValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "body is not an object" };
  }
  const row = raw as Record<string, unknown>;
  const patch: BillPatch = {};

  if ("payee" in row) {
    const payee = typeof row.payee === "string" ? row.payee.trim() : "";
    if (!payee) return { ok: false, message: "payee cannot be empty" };
    patch.payee = payee;
  }

  if ("dueDate" in row) {
    const dueDate = typeof row.dueDate === "string" ? row.dueDate.trim() : "";
    if (!DATE_RE.test(dueDate)) return { ok: false, message: "dueDate must be YYYY-MM-DD" };
    patch.dueDate = dueDate;
  }

  if ("amount" in row) {
    if (row.amount === null || row.amount === "") {
      patch.amount = null;
    } else {
      const parsed = typeof row.amount === "number" ? row.amount : Number(row.amount);
      if (!Number.isFinite(parsed)) return { ok: false, message: "amount is not a valid number" };
      patch.amount = parsed;
    }
  }

  if ("paidDate" in row) {
    if (row.paidDate === null || row.paidDate === "") {
      patch.paidDate = null;
    } else {
      const value = String(row.paidDate).trim();
      if (!DATE_RE.test(value)) return { ok: false, message: "paidDate must be YYYY-MM-DD" };
      patch.paidDate = value;
    }
  }

  if ("notes" in row) {
    patch.notes = typeof row.notes === "string" ? row.notes : "";
  }

  return { ok: true, patch };
}
