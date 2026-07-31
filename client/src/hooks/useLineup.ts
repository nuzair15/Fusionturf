import { useQuery } from "@tanstack/react-query";
import { fetchFixtureLineups } from "@/services/lineupApi";
import type { FixtureLineupResponse } from "@/types/lineup";

export function useLineup(fixtureId: string | undefined) {
  return useQuery<FixtureLineupResponse>({
    queryKey: ["fixture-lineups", fixtureId],
    queryFn: () => fetchFixtureLineups(fixtureId as string),
    enabled: !!fixtureId,
  });
}
