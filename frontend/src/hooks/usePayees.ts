import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addPayee, fetchPayees } from "../api/payees";

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
      const previous = queryClient.getQueryData<string[]>(PAYEES_KEY);
      if (previous && !previous.some((p) => p.toLowerCase() === name.toLowerCase())) {
        queryClient.setQueryData<string[]>(PAYEES_KEY, [...previous, name].sort((a, b) => a.localeCompare(b)));
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
