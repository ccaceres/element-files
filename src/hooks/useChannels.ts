import { useQuery } from "@tanstack/react-query";
import { getTeamChannels } from "@/api/teams";

export function useChannels(teamId: string | null) {
  return useQuery({
    queryKey: ["channels", teamId],
    queryFn: () => getTeamChannels(teamId ?? ""),
    enabled: Boolean(teamId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

