import { Bill, BillInput, BillPatch, ImportResult } from "../types/bill";
import { apiFetch } from "./client";

export async function fetchBills(): Promise<Bill[]> {
  const data = await apiFetch<{ bills: Bill[] }>("/bills");
  return data.bills;
}

export async function createBill(input: BillInput): Promise<Bill> {
  const data = await apiFetch<{ bill: Bill }>("/bills", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.bill;
}

export async function updateBill(id: string, patch: BillPatch): Promise<Bill> {
  const data = await apiFetch<{ bill: Bill }>(`/bills/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.bill;
}

export async function deleteBill(id: string): Promise<void> {
  await apiFetch(`/bills/${id}`, { method: "DELETE" });
}

export async function importBills(rows: BillInput[]): Promise<ImportResult> {
  return apiFetch<ImportResult>("/bills/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}
