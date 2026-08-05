import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addPayee, deletePayee, fetchPayees, updatePayee } from "../api/payees";
import { Payee } from "../types/payee";
import { BILLS_KEY } from "./useBills";

export const PAYEES_KEY = ["payees"];

export function usePayeesQuery() {
  return useQuery({ queryKey: PAYEES_KEY, queryFn: fetchPayees });
}

export function useAddPayee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => addPayee(name),
    onMutate: async (name: string) => {
      await queryClient.cancelQueries({ queryKey: PAYEES_KEY });
      const previous = queryClient.getQueryData<Payee[]>(PAYEES_KEY);
      if (previous && !previous.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        const optimistic: Payee = { id: `temp-${Date.now()}`, name };
        queryClient.setQueryData<Payee[]>(
          PAYEES_KEY,
          [...previous, optimistic].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      return { previous };
    },
    onError: (_err, _name, context) => {
      if (context?.previous) queryClient.setQueryData(PAYEES_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PAYEES_KEY });
    },
  });
}

// Rename/delete are a low-frequency admin surface (Manage Payees), not the hot inline-edit
// path — no optimistic updates here. A rename's cache blast radius (every cached bill whose
// payeeId matches) and a delete's validity (server-side "is it in use" check) are both better
// left to a plain invalidate-on-success than an optimistic guess.
export function useUpdatePayee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updatePayee(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYEES_KEY });
      queryClient.invalidateQueries({ queryKey: BILLS_KEY });
    },
  });
}

export function useDeletePayee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePayee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYEES_KEY });
    },
  });
}
