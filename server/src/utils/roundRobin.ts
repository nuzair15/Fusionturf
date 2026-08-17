/**
 * Pure round-robin fixture scheduling math, deliberately kept free of any
 * database import. league-system.ts (which does need Prisma) uses this for
 * the actual schedule generation, but keeping it in its own module means:
 *  - these functions are unit-testable without a generated Prisma client
 *    or a live database connection
 *  - the "how many weeks does this need" calculation can't silently drift
 *    out of sync with the code that actually lays out the rounds, since
 *    both live next to each other here
 */

export interface FixtureSlot {
  homeTeamIdx: number;
  awayTeamIdx: number;
}

export function generateRoundRobinPairings(teams: number): FixtureSlot[][] {
  const rounds: FixtureSlot[][] = [];
  const n = teams % 2 === 0 ? teams : teams + 1;
  const half = n / 2;
  const teamIndices = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < n - 1; round++) {
    const fixtures: FixtureSlot[] = [];
    for (let i = 0; i < half; i++) {
      const home = teamIndices[i];
      const away = teamIndices[n - 1 - i];
      if (home < teams && away < teams) {
        fixtures.push(round % 2 === 0
          ? { homeTeamIdx: home, awayTeamIdx: away }
          : { homeTeamIdx: away, awayTeamIdx: home }
        );
      }
    }
    rounds.push(fixtures);
    teamIndices.splice(1, 0, teamIndices.pop()!);
  }

  return rounds;
}

// How many weeks (one round per week) a complete round-robin schedule needs:
// (teamCount - 1) rounds per leg, doubled for a home-and-away double
// round-robin. This used to be a hardcoded constant (7) that fell out of
// sync with what a 6-team double round-robin actually needs (10) — see the
// leagueWeeks validation in generateSeasonFixtures for what that caused.
export function requiredLeagueWeeks(teamCount: number, matchesPerPair: number): number {
  const roundsPerLeg = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  return matchesPerPair >= 2 ? roundsPerLeg * 2 : roundsPerLeg;
}
