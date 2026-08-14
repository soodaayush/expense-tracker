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

export interface Payee {
  id: string;
  name: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
}

export interface BillInput {
  payee: string;
  paymentMethod: string | null;
  amount: number | null;
  dueDate: string;
  paidDate: string | null;
  notes: string;
}

export type BillPatch = Partial<BillInput>;

export interface ImportRowInput {
  payee: string;
  paymentMethod: string | null;
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

export interface NotificationPreferences {
  email: string | null;
  enabled: boolean;
  leadDays: number;
  sendHour: number;
  sendMinute: number;
  timeZone: string;
}

export type NotificationPreferencesPatch = Partial<NotificationPreferences>;
