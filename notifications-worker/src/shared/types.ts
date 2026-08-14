// Kept as a local copy rather than importing across projects — this worker deploys as a fully
// separate Azure Function App from api/ (see the timer-trigger note in notificationsSend.ts),
// so it isn't bundled/packaged together with api/ and can't share its modules at build time.
// Only the shapes this worker actually touches are duplicated here, not the full api/shared/types.ts.

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

export interface NotificationPreferences {
  email: string | null;
  enabled: boolean;
  leadDays: number;
  sendHour: number;
  sendMinute: number;
  timeZone: string;
}
