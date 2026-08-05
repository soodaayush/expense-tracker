export interface Bill {
  id: string;
  payeeId: string;
  payee: string;
  amount: number | null;
  dueDate: string;
  paidDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// payeeId is server-derived (resolved/created from the `payee` name on write) — never sent by
// the client, so it's excluded here alongside the other server-owned fields.
export type BillInput = Omit<Bill, "id" | "payeeId" | "createdAt" | "updatedAt">;

export type BillPatch = Partial<BillInput>;

export interface ImportResult {
  inserted: number;
  errors: Array<{ rowIndex: number; message: string }>;
}
