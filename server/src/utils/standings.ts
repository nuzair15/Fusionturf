export interface RankingStats {
  pts: number;
  gd: number;
  gf: number;
}

export interface RankingFixture {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

/** Rank equal-points groups by their head-to-head goal difference. */
export function rankStandings(
  teamIds: string[],
  stats: Record<string, RankingStats>,
  fixtures: RankingFixture[],
  names: Record<string, string> = {},
): string[] {
  const byPoints = new Map<number, string[]>();
  for (const teamId of teamIds) {
    const group = byPoints.get(stats[teamId].pts) || [];
    group.push(teamId);
    byPoints.set(stats[teamId].pts, group);
  }

  const ranked: string[] = [];
  for (const total of [...byPoints.keys()].sort((a, b) => b - a)) {
    const tied = byPoints.get(total)!;
    if (tied.length === 1) {
      ranked.push(tied[0]);
      continue;
    }
    const members = new Set(tied);
    const mini = Object.fromEntries(tied.map((id) => [id, { gf: 0, ga: 0, gd: 0 }]));
    for (const fixture of fixtures) {
      if (fixture.homeScore == null || fixture.awayScore == null || !members.has(fixture.homeTeamId) || !members.has(fixture.awayTeamId)) continue;
      const home = mini[fixture.homeTeamId];
      const away = mini[fixture.awayTeamId];
      home.gf += fixture.homeScore; home.ga += fixture.awayScore;
      away.gf += fixture.awayScore; away.ga += fixture.homeScore;
    }
    for (const id of tied) mini[id].gd = mini[id].gf - mini[id].ga;
    tied.sort((a, b) =>
      mini[b].gd - mini[a].gd ||
      mini[b].gf - mini[a].gf ||
      (names[a] || a).localeCompare(names[b] || b) ||
      a.localeCompare(b));
    ranked.push(...tied);
  }
  return ranked;
}
