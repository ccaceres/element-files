import { useQuery } from "@tanstack/react-query";
import { getJoinedTeams } from "@/api/teams";
import { useTokenContext } from "@/auth/TokenContext";

export function useTeams() {
  const { token } = useTokenContext();

  return useQuery({
    queryKey: ["teams"],
    queryFn: getJoinedTeams,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

