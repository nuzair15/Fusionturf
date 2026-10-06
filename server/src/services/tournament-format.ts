export const TOURNAMENT_FORMATS = ["ROUND_ROBIN", "DOUBLE_ROUND_ROBIN_FINAL", "SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "GROUPS_KNOCKOUT"] as const;
export type TournamentFormat = typeof TOURNAMENT_FORMATS[number];

export type PlannedPair = { homeTeamId: string; awayTeamId: string; round: number; stage: string; groupName?: string };

// Circle method: every pair meets once per leg, with an explicit bye for odd fields.
export function roundRobin(teamIds: string[], legs = 1, stage = "LEAGUE", groupName?: string): PlannedPair[] {
  if (teamIds.length < 2) return [];
  const participants: Array<string | null> = [...teamIds];
  if (participants.length % 2) participants.push(null);
  const result: PlannedPair[] = [];
  const n = participants.length;
  let ring = [...participants];
  for (let leg = 0; leg < legs; leg++) {
    for (let round = 0; round < n - 1; round++) {
      for (let i = 0; i < n / 2; i++) {
        const a = ring[i], b = ring[n - 1 - i];
        if (!a || !b) continue;
        const swap = (round + leg) % 2 === 1;
        result.push({ homeTeamId: swap ? b : a, awayTeamId: swap ? a : b, round: leg * (n - 1) + round + 1, stage, groupName });
      }
      ring = [ring[0], ring[n - 1], ...ring.slice(1, n - 1)];
    }
  }
  return result;
}

export function seededPairs(teamIds: string[], round: number, stage: string): PlannedPair[] {
  const pairs: PlannedPair[] = [];
  for (let i = 0; i < Math.floor(teamIds.length / 2); i++) {
    pairs.push({ homeTeamId: teamIds[i], awayTeamId: teamIds[teamIds.length - 1 - i], round, stage });
  }
  return pairs;
}

export function assignGroups<T extends { id: string }>(teams: T[], count: number): Map<string, string> {
  const groups = new Map<string, string>();
  teams.forEach((team, index) => {
    // Serpentine distribution keeps seeded teams spread across groups.
    const cycle = Math.floor(index / count);
    const group = cycle % 2 === 0 ? index % count : count - 1 - (index % count);
    groups.set(team.id, String.fromCharCode(65 + group));
  });
  return groups;
}

export type ResultRow = { homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number; status: string; groupName?: string | null };
export function standings(teamIds: string[], fixtures: ResultRow[]) {
  const rows = new Map(teamIds.map(id => [id, { teamId: id, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }]));
  for (const fixture of fixtures) {
    if (fixture.status !== "COMPLETED") continue;
    const home = rows.get(fixture.homeTeamId), away = rows.get(fixture.awayTeamId);
    if (!home || !away) continue;
    home.played++; away.played++;
    home.goalsFor += fixture.homeScore; home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore; away.goalsAgainst += fixture.homeScore;
    if (fixture.homeScore > fixture.awayScore) { home.wins++; away.losses++; home.points += 3; }
    else if (fixture.homeScore < fixture.awayScore) { away.wins++; home.losses++; away.points += 3; }
    else { home.draws++; away.draws++; home.points++; away.points++; }
  }
  return [...rows.values()].map(row => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId));
}
