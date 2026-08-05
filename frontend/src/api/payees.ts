import { Payee } from "../types/payee";
import { apiFetch } from "./client";

export async function fetchPayees(): Promise<Payee[]> {
  const data = await apiFetch<{ payees: Payee[] }>("/payees");
  return data.payees;
}

export async function addPayee(name: string): Promise<Payee[]> {
  const data = await apiFetch<{ payees: Payee[] }>("/payees", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.payees;
}

export async function updatePayee(id: string, name: string): Promise<Payee> {
  const data = await apiFetch<{ payee: Payee }>(`/payees/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return data.payee;
}

export async function deletePayee(id: string): Promise<void> {
  await apiFetch(`/payees/${id}`, { method: "DELETE" });
}
