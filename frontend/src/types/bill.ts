export interface Bill {
  id: string;
  payee: string;
  amount: number | null;
  dueDate: string;
  paidDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type BillInput = Omit<Bill, "id" | "createdAt" | "updatedAt">;

export type BillPatch = Partial<BillInput>;

export interface ImportResult {
  inserted: number;
  errors: Array<{ rowIndex: number; message: string }>;
}
