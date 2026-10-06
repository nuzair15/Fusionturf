import type { MatchStatus } from "@/types";

export type TournamentFormat = "ROUND_ROBIN" | "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "GROUPS_KNOCKOUT";
export type TournamentStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "COMPLETED";
export interface TournamentPlayer {
  id: string; teamId: string; firstName: string; lastName: string; jerseyNumber: number | null;
  position: string | null; photoUrl: string | null; dateOfBirth: string | null; nationality: string | null; isActive: boolean;
}
export interface TournamentTeam {
  id: string; tournamentId: string; name: string; shortName: string | null; logoUrl: string | null;
  city: string | null; coach: string | null; contact: string | null; description: string | null;
  groupName: string | null; seed: number | null; players: TournamentPlayer[];
}
export interface TournamentLineup { id: string; teamId: string; playerId: string; isStarter: boolean; isCaptain: boolean; isGoalkeeper: boolean; position: string | null }
export interface TournamentEvent {
  id: string; kind: string; minute: number; teamId: string | null; playerId: string | null;
  relatedPlayerId: string | null; playerName: string | null; relatedPlayerName: string | null; note: string | null;
}
export interface TournamentFixture {
  id: string; tournamentId: string; homeTeamId: string; awayTeamId: string; homeTeam: TournamentTeam; awayTeam: TournamentTeam;
  winnerTeamId: string | null; stage: string; groupName: string | null; round: number; slot: number;
  kickoffAt: string; status: MatchStatus; homeScore: number; awayScore: number;
  penaltiesHomeScore: number | null; penaltiesAwayScore: number | null; matchClockSeconds: number;
  lineups: TournamentLineup[]; events: TournamentEvent[];
}
export interface Tournament {
  id: string; name: string; slug: string; description: string | null; logoUrl: string | null;
  format: TournamentFormat; status: TournamentStatus; startDate: string | null; endDate: string | null;
  timezone: string; lineupSize: number; halfLengthMinutes: number; halftimeBreakMinutes: number;
  matchesPerPair: number; groupCount: number | null; qualifiersPerGroup: number | null;
  kickoffTime: string | null; matchIntervalMinutes: number; matchesPerDay: number;
  teams: TournamentTeam[]; fixtures: TournamentFixture[];
  standings: Record<string, Array<{ teamId: string; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number }>>;
  _count?: { teams: number; fixtures: number };
}
export const TOURNAMENT_FORMAT_LABEL: Record<TournamentFormat, string> = {
  ROUND_ROBIN: "Round robin league",
  SINGLE_ELIMINATION: "Single elimination",
  DOUBLE_ELIMINATION: "Double elimination",
  GROUPS_KNOCKOUT: "Groups + knockout",
};
