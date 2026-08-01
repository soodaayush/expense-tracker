import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBill, deleteBill, fetchBills, importBills, updateBill } from "../api/bills";
import { PAYEES_KEY } from "./usePayees";
import { Bill, BillInput, BillPatch } from "../types/bill";

const BILLS_KEY = ["bills"];

export function useBillsQuery() {
  return useQuery({ queryKey: BILLS_KEY, queryFn: fetchBills });
}

function useOptimisticMutation<TVariables>(
  mutationFn: (vars: TVariables) => Promise<unknown>,
  updater: (bills: Bill[], vars: TVariables) => Bill[],
  options: { invalidatePayees?: boolean } = {}
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      },
    ],
    { invalidatePayees: true }
  );
}

export function useUpdateBill() {
  return useOptimisticMutation<{ id: string; patch: BillPatch }>(
    ({ id, patch }) => updateBill(id, patch),
    (bills, { id, patch }) => bills.map((bill) => (bill.id === id ? { ...bill, ...patch } : bill)),
    { invalidatePayees: true }
  );
}

export function useDeleteBill() {
  return useOptimisticMutation<string>(
    (id) => deleteBill(id),
    (bills, id) => bills.filter((bill) => bill.id !== id)
  );
}

export function useImportBills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: BillInput[]) => importBills(rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_KEY });
      queryClient.invalidateQueries({ queryKey: PAYEES_KEY });
    },
  });
}
