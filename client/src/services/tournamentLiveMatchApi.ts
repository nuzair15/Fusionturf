import { api } from "@/lib/api";
import type { LiveMatchData } from "@/types/live";
import type { MatchStatus } from "@/types";
import type { StatType } from "./liveMatchApi";

// The existing match control center uses this adapter for an independent
// tournament match. No request is sent to a Fusion League fixture endpoint.
export function tournamentLiveMatchApi(tournamentId: string) {
  const root = (fixtureId: string) => `/admin/tournaments/${tournamentId}/fixtures/${fixtureId}`;
  const action = (fixtureId: string, body: Record<string, unknown>) => api.post(`${root(fixtureId)}/live-action`, body);
  return {
    fetchLiveStats: (fixtureId: string) => api.get<LiveMatchData>(`${root(fixtureId)}/live-stats`),
    setStatus: (fixtureId: string, status: MatchStatus, correctionReason?: string) => action(fixtureId, { action: "setStatus", status, correctionReason }),
    resetClock: (fixtureId: string) => action(fixtureId, { action: "resetClock" }),
    setClock: (fixtureId: string, seconds: number) => action(fixtureId, { action: "setClock", seconds }),
    completePenaltyShootout: (fixtureId: string, body: { homeScore: number; awayScore: number; penaltiesHomeScore: number; penaltiesAwayScore: number; winnerTeamId: string; reason?: string; version?: number }) => action(fixtureId, { action: "completePenaltyShootout", ...body, correctionReason: body.reason }),
    updateLiveStat: (fixtureId: string, body: { playerId: string; statType: StatType; teamId: string; action: "increment" | "decrement"; minute?: number; correctionReason?: string }) => action(fixtureId, { ...body, action: "updateLiveStat", statAction: body.action }),
    updateTeamStats: (fixtureId: string, body: Record<string, number | string>) => action(fixtureId, { action: "updateTeamStats", ...body }),
    addGoal: (fixtureId: string, body: { teamId: string; scorerId: string; assistId?: string; minute: number; isOwnGoal?: boolean; isPenalty?: boolean; correctionReason?: string }) => action(fixtureId, { action: "addGoal", ...body }),
    addAwardedGoal: (fixtureId: string, body: { teamId: string; minute: number; correctionReason?: string }) => action(fixtureId, { action: "addAwardedGoal", ...body }),
    updateGoal: (fixtureId: string, goalId: string, body: { teamId: string; scorerId: string; assistId?: string | null; minute: number; isOwnGoal: boolean; isPenalty: boolean; correctionReason?: string }) => action(fixtureId, { action: "updateGoal", goalId, ...body }),
    updateCard: (fixtureId: string, cardId: string, body: { teamId: string; playerId: string; type: "YELLOW" | "SECOND_YELLOW" | "RED"; minute: number; correctionReason?: string }) => action(fixtureId, { action: "updateCard", cardId, ...body }),
    addSubstitution: (fixtureId: string, body: { teamId: string; playerOffId: string; playerOnId: string; minute: number; correctionReason?: string }) => action(fixtureId, { action: "addSubstitution", ...body }),
    addNote: (fixtureId: string, body: { teamId?: string; playerId?: string; type: "VAR" | "MISSED_PENALTY" | "INFO"; minute: number; note?: string; correctionReason?: string }) => action(fixtureId, { action: "addNote", ...body }),
    recordAppearance: (fixtureId: string, body: { playerId: string; teamId: string; minute?: number; isStarter?: boolean; correctionReason?: string }) => action(fixtureId, { action: "recordAppearance", ...body }),
    recordShot: (fixtureId: string, body: { playerId: string; teamId: string; outcome: "ON_TARGET" | "OFF_TARGET"; minute?: number; correctionReason?: string }) => action(fixtureId, { action: "recordShot", ...body }),
    removeEvent: (fixtureId: string, type: "goal" | "assist" | "card" | "substitution" | "note", eventId: string, correctionReason?: string) => action(fixtureId, { action: "removeEvent", type, eventId, correctionReason }),
    removeGoal: (fixtureId: string, playerId: string, correctionReason?: string) => action(fixtureId, { action: "removeGoal", playerId, correctionReason }),
    setMatchRating: (fixtureId: string, body: { playerId: string; rating: number; correctionReason?: string }) => action(fixtureId, { action: "setMatchRating", ...body }),
    setManOfTheMatch: (fixtureId: string, body: { playerId?: string; correctionReason?: string }) => action(fixtureId, { action: "setManOfTheMatch", ...body }),
  };
}
