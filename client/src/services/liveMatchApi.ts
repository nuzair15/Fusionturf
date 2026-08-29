import { api } from "@/lib/api";
import type { LiveMatchData } from "@/types/live";
import type { MatchStatus } from "@/types";

export type StatType = "goal" | "assist" | "yellowCard" | "redCard";
type Correction = { correctionReason?: string };

export const liveMatchApi = {
  fetchLiveStats: (fixtureId: string) => api.get<LiveMatchData>(`/admin/fixtures/${fixtureId}/live-stats`),

  setStatus: (fixtureId: string, status: MatchStatus) =>
    api.patch(`/admin/fixtures/${fixtureId}/status`, { status }),
  resetClock: (fixtureId: string) => api.post(`/admin/fixtures/${fixtureId}/live-stats/reset-clock`),

  updateLiveStat: (fixtureId: string, body: { playerId: string; statType: StatType; teamId: string; action: "increment" | "decrement" } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/live-stats/update`, body),

  updateTeamStats: (fixtureId: string, body: Record<string, number | string>) =>
    api.patch(`/admin/fixtures/${fixtureId}/live-stats/team`, body),

  addGoal: (fixtureId: string, body: { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal?: boolean; isPenalty?: boolean } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/goal`, body),

  addAwardedGoal: (fixtureId: string, body: { teamId: string; minute: number } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/awarded-goal`, body),

  updateGoal: (fixtureId: string, goalId: string, body: { teamId: string; scorerId: string; assistId?: string | null; minute: number; isOwnGoal: boolean; isPenalty: boolean } & Correction) =>
    api.patch(`/admin/fixtures/${fixtureId}/goal/${goalId}`, body),

  addSubstitution: (fixtureId: string, body: { teamId: string; playerOffId: string; playerOnId: string; minute: number } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/substitution`, body),

  addNote: (fixtureId: string, body: { teamId?: string; playerId?: string; type: "VAR" | "MISSED_PENALTY" | "INFO"; minute: number; note?: string } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/note`, body),

  recordAppearance: (fixtureId: string, body: { playerId: string; teamId: string; minute?: number; isStarter?: boolean } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/appearance`, body),

  recordShot: (fixtureId: string, body: { playerId: string; teamId: string; outcome: "ON_TARGET" | "OFF_TARGET"; minute?: number } & Correction) =>
    api.post(`/admin/fixtures/${fixtureId}/shot`, body),

  removeEvent: (fixtureId: string, type: "goal" | "assist" | "card" | "substitution" | "note", id: string, correctionReason?: string) =>
    api.post(`/admin/fixtures/${fixtureId}/event/remove`, { type, id, correctionReason }),

  removeGoal: (fixtureId: string, playerId: string, correctionReason?: string) =>
    api.post(`/admin/fixtures/${fixtureId}/goal/remove`, { playerId, correctionReason }),

  setMatchRating: (fixtureId: string, body: { playerId: string; rating: number } & Correction) =>
    api.patch(`/admin/fixtures/${fixtureId}/match-rating`, body),

  setManOfTheMatch: (fixtureId: string, body: { playerId?: string } & Correction) =>
    api.patch(`/admin/fixtures/${fixtureId}/man-of-the-match`, body),
};
