import { api } from "@/lib/api";
import type { LiveMatchData } from "@/types/live";
import type { MatchStatus } from "@/types";

export type StatType = "goal" | "assist" | "yellowCard" | "redCard";

export const liveMatchApi = {
  fetchLiveStats: (fixtureId: string) => api.get<LiveMatchData>(`/admin/fixtures/${fixtureId}/live-stats`),

  setStatus: (fixtureId: string, status: MatchStatus) =>
    api.patch(`/admin/fixtures/${fixtureId}/status`, { status }),
  resetClock: (fixtureId: string) => api.post(`/admin/fixtures/${fixtureId}/live-stats/reset-clock`),

  updateLiveStat: (fixtureId: string, body: { playerId: string; statType: StatType; teamId: string; action: "increment" | "decrement" }) =>
    api.post(`/admin/fixtures/${fixtureId}/live-stats/update`, body),

  updateTeamStats: (fixtureId: string, body: Record<string, number>) =>
    api.patch(`/admin/fixtures/${fixtureId}/live-stats/team`, body),

  addGoal: (fixtureId: string, body: { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal?: boolean; isPenalty?: boolean }) =>
    api.post(`/admin/fixtures/${fixtureId}/goal`, body),

  addSubstitution: (fixtureId: string, body: { teamId: string; playerOffId: string; playerOnId: string; minute: number }) =>
    api.post(`/admin/fixtures/${fixtureId}/substitution`, body),

  addNote: (fixtureId: string, body: { teamId?: string; playerId?: string; type: "VAR" | "MISSED_PENALTY" | "INFO"; minute: number; note?: string }) =>
    api.post(`/admin/fixtures/${fixtureId}/note`, body),

  removeEvent: (fixtureId: string, type: "goal" | "assist" | "card" | "substitution" | "note", id: string) =>
    api.post(`/admin/fixtures/${fixtureId}/event/remove`, { type, id }),

  removeGoal: (fixtureId: string, playerId: string) =>
    api.post(`/admin/fixtures/${fixtureId}/goal/remove`, { playerId }),

  setMatchRating: (fixtureId: string, body: { playerId: string; rating: number }) =>
    api.patch(`/admin/fixtures/${fixtureId}/match-rating`, body),

  setManOfTheMatch: (fixtureId: string, body: { playerId?: string }) =>
    api.patch(`/admin/fixtures/${fixtureId}/man-of-the-match`, body),
};
