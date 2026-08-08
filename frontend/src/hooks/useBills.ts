import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createBill, deleteBill, fetchBills, importBills, updateBill } from "../api/bills";
import { PAYEES_KEY } from "./usePayees";
import { PAYMENT_METHODS_KEY } from "./usePaymentMethods";
import { Bill, BillInput, BillPatch, ImportResult } from "../types/bill";

export const BILLS_KEY = ["bills"];

// Matches the server's MAX_IMPORT_ROWS backstop (api/src/functions/billsImport.ts) — large
// imports are split into requests this size so no single request can lag out or time out
// regardless of total row count.
export const IMPORT_CHUNK_SIZE = 500;

export interface ImportProgress {
  totalChunks: number;
  completedChunks: number;
  inserted: number;
  errors: ImportResult["errors"];
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function useBillsQuery() {
  return useQuery({ queryKey: BILLS_KEY, queryFn: fetchBills });
}

function useOptimisticMutation<TVariables>(
  mutationFn: (vars: TVariables) => Promise<unknown>,
  updater: (bills: Bill[], vars: TVariables) => Bill[],
  options: { invalidatePayees?: boolean; invalidatePaymentMethods?: boolean } = {}
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVariables) => {
      await queryClient.cancelQueries({ queryKey: BILLS_KEY });
      const previous = queryClient.getQueryData<Bill[]>(BILLS_KEY);
      queryClient.setQueryData<Bill[]>(BILLS_KEY, (old) => updater(old ?? [], vars));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(BILLS_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_KEY });
      if (options.invalidatePayees) queryClient.invalidateQueries({ queryKey: PAYEES_KEY });
      if (options.invalidatePaymentMethods) queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY });
    },
  });
}

export function useCreateBill() {
  return useOptimisticMutation<BillInput>(
    (input) => createBill(input),
    (bills, input) => [
      ...bills,
      {
        id: `temp-${Date.now()}`,
        payeeId: `temp-${Date.now()}`,
        paymentMethodId: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      },
    ],
    { invalidatePayees: true, invalidatePaymentMethods: true }
  );
}

export function useUpdateBill() {
  return useOptimisticMutation<{ id: string; patch: BillPatch }>(
    ({ id, patch }) => updateBill(id, patch),
    (bills, { id, patch }) => bills.map((bill) => (bill.id === id ? { ...bill, ...patch } : bill)),
    { invalidatePayees: true, invalidatePaymentMethods: true }
  );
}

export function useDeleteBill() {
  return useOptimisticMutation<string>(
    (id) => deleteBill(id),
    (bills, id) => bills.filter((bill) => bill.id !== id)
  );
}

// Sends large imports as a sequence of small requests instead of one all-or-nothing request —
// this is what fixed the prod incident where a single 10k-row import lagged out mid-request and
// silently lost whatever hadn't been processed yet, with the client never receiving a response.
// Splitting into chunks bounds each request's duration regardless of total row count, and
// `progress.completedChunks` lets a caller resume from exactly where a failed attempt stopped
// instead of resending already-committed rows.
export function useImportBills() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (rows: BillInput[]) => {
      const chunks = chunkRows(rows, IMPORT_CHUNK_SIZE);
      const result: ImportResult = { inserted: 0, errors: [] };
      setProgress({ totalChunks: chunks.length, completedChunks: 0, inserted: 0, errors: [] });

      for (let i = 0; i < chunks.length; i++) {
        const offset = i * IMPORT_CHUNK_SIZE;
        const chunkResult = await importBills(chunks[i]);
        result.inserted += chunkResult.inserted;
        result.errors.push(...chunkResult.errors.map((e) => ({ ...e, rowIndex: e.rowIndex + offset })));
        setProgress({ totalChunks: chunks.length, completedChunks: i + 1, inserted: result.inserted, errors: result.errors });
      }
      return result;
    },
    onSettled: () => {
      // Invalidate on both success and failure — a failed attempt may still have committed
      // some earlier chunks, and the grid should reflect that.
      queryClient.invalidateQueries({ queryKey: BILLS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYEES_KEY });
    },
  });

  return { ...mutation, progress };
}
