export interface Bill {
  id: string;
  payeeId: string;
  payee: string;
  paymentMethodId: string | null;
  paymentMethod: string | null;
  amount: number | null;
  dueDate: string;
  paidDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// payeeId/paymentMethodId are server-derived (resolved/created from the `payee`/`paymentMethod`
// name on write) — never sent by the client, so they're excluded here alongside the other
// server-owned fields.
export type BillInput = Omit<Bill, "id" | "payeeId" | "paymentMethodId" | "createdAt" | "updatedAt">;

export type BillPatch = Partial<BillInput>;

export interface ImportResult {
  inserted: number;
  errors: Array<{ rowIndex: number; message: string }>;
}
