import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSession } from "../api/auth";

export function useSession() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 60_000,
  });

  return {
    authenticated: query.data?.authenticated ?? false,
    displayName: query.data?.displayName,
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  };
}
