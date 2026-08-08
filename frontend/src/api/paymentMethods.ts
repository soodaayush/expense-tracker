import { PaymentMethod } from "../types/paymentMethod";
import { apiFetch } from "./client";

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const data = await apiFetch<{ paymentMethods: PaymentMethod[] }>("/payment-methods");
  return data.paymentMethods;
}

export async function addPaymentMethod(name: string): Promise<PaymentMethod[]> {
  const data = await apiFetch<{ paymentMethods: PaymentMethod[] }>("/payment-methods", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.paymentMethods;
}

export async function updatePaymentMethod(id: string, name: string): Promise<PaymentMethod> {
  const data = await apiFetch<{ paymentMethod: PaymentMethod }>(`/payment-methods/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return data.paymentMethod;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await apiFetch(`/payment-methods/${id}`, { method: "DELETE" });
}
