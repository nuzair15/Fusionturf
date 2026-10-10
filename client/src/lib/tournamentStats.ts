import type { Tournament } from "@/types/tournament";

export type TournamentStatKey = "goals" | "assists" | "yellowCards" | "redCards";

export interface TournamentStatLeader {
  playerId: string | null;
  playerName: string;
  photoUrl: string | null;
  teamId: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  value: number;
}

type TournamentStatsSource = Pick<Tournament, "teams" | "fixtures">;
type Accumulator = Omit<TournamentStatLeader, "value"> & Record<TournamentStatKey, number>;

const eventStat = (kind: string): TournamentStatKey | null => {
  if (kind === "GOAL" || kind === "PENALTY_GOAL") return "goals";
  if (kind === "ASSIST") return "assists";
  if (kind === "YELLOW" || kind === "SECOND_YELLOW") return "yellowCards";
  if (kind === "RED") return "redCards";
  return null;
};

export function calculateTournamentLeaders(source: TournamentStatsSource): Record<TournamentStatKey, TournamentStatLeader[]> {
  const players = new Map(source.teams.flatMap(team => team.players.map(player => [player.id, player] as const)));
  const teams = new Map(source.teams.map(team => [team.id, team] as const));
  const totals = new Map<string, Accumulator>();

  for (const fixture of source.fixtures) {
    for (const event of fixture.events) {
      const stat = eventStat(event.kind);
      if (!stat || (!event.playerId && !event.playerName)) continue;
      const player = event.playerId ? players.get(event.playerId) : undefined;
      const team = event.teamId ? teams.get(event.teamId) : undefined;
      const playerName = player ? `${player.firstName} ${player.lastName}`.trim() : event.playerName?.trim() || "Unknown player";
      const key = event.playerId || `${event.teamId || "unknown-team"}:${playerName}`;
      const row = totals.get(key) || {
        playerId: event.playerId,
        playerName,
        photoUrl: player?.photoUrl || null,
        teamId: event.teamId,
        teamName: team?.name || "Unknown team",
        teamLogoUrl: team?.logoUrl || null,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      };
      row[stat]++;
      totals.set(key, row);
    }
  }

  const result = {} as Record<TournamentStatKey, TournamentStatLeader[]>;
  for (const stat of ["goals", "assists", "yellowCards", "redCards"] as const) {
    result[stat] = [...totals.values()]
      .filter(row => row[stat] > 0)
      .sort((a, b) => b[stat] - a[stat] || a.playerName.localeCompare(b.playerName))
      .map(row => ({
        playerId: row.playerId,
        playerName: row.playerName,
        photoUrl: row.photoUrl,
        teamId: row.teamId,
        teamName: row.teamName,
        teamLogoUrl: row.teamLogoUrl,
        value: row[stat],
      }));
  }
  return result;
}
