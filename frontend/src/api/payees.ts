import { apiFetch } from "./client";

export async function fetchPayees(): Promise<string[]> {
  const data = await apiFetch<{ payees: string[] }>("/payees");
  return data.payees;
}

export async function addPayee(name: string): Promise<string[]> {
  const data = await apiFetch<{ payees: string[] }>("/payees", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.payees;
}
