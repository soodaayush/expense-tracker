import { BillInput } from "../types/bill";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDateFlexible(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dMonY = trimmed.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/);
  if (dMonY) {
    const monthIdx = MONTHS.indexOf(dMonY[2].slice(0, 3).toLowerCase());
    if (monthIdx >= 0) {
      return `${dMonY[3]}-${String(monthIdx + 1).padStart(2, "0")}-${dMonY[1].padStart(2, "0")}`;
    }
  }

  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  return null;
}

export function parseAmountFlexible(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[$,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export const TARGET_FIELDS = ["payee", "paymentMethod", "amount", "dueDate", "paidDate", "notes"] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];

export const FIELD_LABELS: Record<TargetField, string> = {
  payee: "Payee",
  paymentMethod: "Payment Method",
  amount: "Amount",
  dueDate: "Due Date",
  paidDate: "Paid Date",
  notes: "Notes",
};

export function guessColumnMapping(headers: string[]): Record<TargetField, string | null> {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const mapping = {} as Record<TargetField, string | null>;
  const aliases: Record<TargetField, string[]> = {
    payee: ["payee", "name", "vendor"],
    paymentMethod: ["paymentmethod", "paymethod", "method", "payment"],
    amount: ["amount", "amt"],
    dueDate: ["duedate", "due"],
    paidDate: ["paiddate", "paid"],
    notes: ["notes", "note", "memo"],
  };
  for (const field of TARGET_FIELDS) {
    const match = headers.find((h) => aliases[field].includes(normalize(h)));
    mapping[field] = match ?? null;
  }
  return mapping;
}

export interface ValidatedRow {
  input: BillInput;
  valid: boolean;
  error?: string;
}

export function normalizeRow(
  raw: Record<string, string>,
  mapping: Record<TargetField, string | null>
): ValidatedRow {
  const rawPayee = mapping.payee ? raw[mapping.payee] ?? "" : "";
  const rawPaymentMethod = mapping.paymentMethod ? raw[mapping.paymentMethod] ?? "" : "";
  const rawAmount = mapping.amount ? raw[mapping.amount] ?? "" : "";
  const rawDueDate = mapping.dueDate ? raw[mapping.dueDate] ?? "" : "";
  const rawPaidDate = mapping.paidDate ? raw[mapping.paidDate] ?? "" : "";
  const rawNotes = mapping.notes ? raw[mapping.notes] ?? "" : "";

  const paymentMethod = rawPaymentMethod.trim() || null;

  const payee = rawPayee.trim();
  if (!payee) {
    return { input: { payee: "", paymentMethod: null, amount: null, dueDate: "", paidDate: null, notes: "" }, valid: false, error: "Payee is required" };
  }

  const dueDate = parseDateFlexible(rawDueDate);
  if (!dueDate) {
    return { input: { payee, paymentMethod: null, amount: null, dueDate: "", paidDate: null, notes: "" }, valid: false, error: `Unrecognized due date: "${rawDueDate}"` };
  }

  const amount = parseAmountFlexible(rawAmount);
  if (amount !== null && Number.isNaN(amount)) {
    return { input: { payee, paymentMethod: null, amount: null, dueDate, paidDate: null, notes: "" }, valid: false, error: `Unrecognized amount: "${rawAmount}"` };
  }

  let paidDate: string | null = null;
  if (rawPaidDate.trim()) {
    paidDate = parseDateFlexible(rawPaidDate);
    if (!paidDate) {
      return { input: { payee, paymentMethod, amount, dueDate, paidDate: null, notes: "" }, valid: false, error: `Unrecognized paid date: "${rawPaidDate}"` };
    }
  }

  return { input: { payee, paymentMethod, amount, dueDate, paidDate, notes: rawNotes }, valid: true };
}
