const additive = ["appearances", "goals", "assists", "minutesPlayed", "shots", "shotsOnTarget", "yellowCards", "redCards", "saves", "cleanSheets", "goalsConceded", "tackles", "interceptions", "fouls", "offsides", "passes", "keyPasses", "dribbles"];

/** Season leaderboards rank a person once even if they played for multiple clubs. */
export function aggregatePlayerTotals(rows: any[]) {
  const totals = new Map<string, any>();
  for (const row of rows) {
    const key = `${row.seasonId}:${row.playerId}`;
    const old = totals.get(key);
    if (!old) { totals.set(key, { ...row, teams: row.team ? [row.team] : [] }); continue; }
    const oldApps = old.appearances || 0, nextApps = row.appearances || 0;
    if (old.averageRating != null || row.averageRating != null) {
      const weight = (old.averageRating == null ? 0 : oldApps) + (row.averageRating == null ? 0 : nextApps);
      old.averageRating = weight ? ((old.averageRating || 0) * oldApps + (row.averageRating || 0) * nextApps) / weight : old.averageRating ?? row.averageRating;
    }
    for (const field of additive) if (old[field] != null || row[field] != null) old[field] = (old[field] || 0) + (row[field] || 0);
    if (row.team && !old.teams.some((t: any) => t.id === row.team.id && t.name === row.team.name)) old.teams.push(row.team);
    if (old.teams.length > 1) old.team = { ...old.team, name: old.teams.map((t: any) => t.name).join(" / ") };
  }
  return [...totals.values()];
}
