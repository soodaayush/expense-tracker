import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addPaymentMethod, deletePaymentMethod, fetchPaymentMethods, updatePaymentMethod } from "../api/paymentMethods";
import { PaymentMethod } from "../types/paymentMethod";
import { BILLS_KEY } from "./useBills";

export const PAYMENT_METHODS_KEY = ["paymentMethods"];

export function usePaymentMethodsQuery() {
  return useQuery({ queryKey: PAYMENT_METHODS_KEY, queryFn: fetchPaymentMethods });
}

export function useAddPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => addPaymentMethod(name),
    onMutate: async (name: string) => {
      await queryClient.cancelQueries({ queryKey: PAYMENT_METHODS_KEY });
      const previous = queryClient.getQueryData<PaymentMethod[]>(PAYMENT_METHODS_KEY);
      if (previous && !previous.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        const optimistic: PaymentMethod = { id: `temp-${Date.now()}`, name };
        queryClient.setQueryData<PaymentMethod[]>(
          PAYMENT_METHODS_KEY,
          [...previous, optimistic].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      return { previous };
    },
    onError: (_err, _name, context) => {
      if (context?.previous) queryClient.setQueryData(PAYMENT_METHODS_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY });
    },
  });
}

// Rename/delete are a low-frequency admin surface (Manage Payment Methods), not the hot
// inline-edit path — no optimistic updates here, mirroring usePayees.
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updatePaymentMethod(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY });
      queryClient.invalidateQueries({ queryKey: BILLS_KEY });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY });
    },
  });
}
