import { api } from "@/lib/api";
import type { FixtureLineupResponse, SaveLineupPayload } from "@/types/lineup";

export async function fetchFixtureLineups(fixtureId: string): Promise<FixtureLineupResponse> {
  return api.get<FixtureLineupResponse>(`/league/fixtures/${fixtureId}/lineups`);
}

export async function saveFixtureLineups(fixtureId: string, payload: SaveLineupPayload): Promise<{ success: boolean }> {
  return api.put<{ success: boolean }>(`/admin/fixtures/${fixtureId}/lineups`, payload);
}
