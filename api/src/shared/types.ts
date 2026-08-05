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

export interface Payee {
  id: string;
  name: string;
}

export interface BillInput {
  payee: string;
  amount: number | null;
  dueDate: string;
  paidDate: string | null;
  notes: string;
}

export type BillPatch = Partial<BillInput>;

export interface ImportRowInput {
  payee: string;
  amount: number | null;
  dueDate: string;
  paidDate: string | null;
  notes: string;
}

export interface ImportResult {
  inserted: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

export interface ApiErrorBody {
  error: string;
}
