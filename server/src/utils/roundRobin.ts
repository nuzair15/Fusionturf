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

export interface WeekPlan {
  week: number;
  roundCount: number;
  matchCount: number;
  /** Matches assigned to each fixture day of this week, in day order. */
  perDay: number[];
}

export interface SchedulePlan {
  feasible: boolean;
  /** Why the plan is infeasible, when it is. */
  reason?: string;
  /** The matches-per-day value the generated schedule will actually use. */
  matchesPerDay: number;
  /** The per-day load the round count would suggest if no cap is set. */
  suggestedMatchesPerDay: number;
  /** Minimum weeks the schedule needs, when a matches-per-day cap is set. */
  minWeeks?: number;
  totalMatches: number;
  weeks: WeekPlan[];
}

/**
 * Pure week/day layout for a season's rounds — no database, no dates. Both
 * the real fixture generation and the admin preview mode call this, so the
 * "will this fit" math can never drift apart between the two (a stale
 * client-side copy of it was the cause of one reported false rejection).
 *
 * Rounds are split across weeks evenly (ceil of remaining / weeks left) and
 * matches within a week fill fixture days up to `matchesPerDay` each. When
 * no cap is given, `matchesPerDay` rises automatically so the requested
 * `leagueWeeks` always fit; with a cap, infeasible week counts are reported
 * up front instead of silently dropping fixtures.
 */
export function planFixtureSchedule(opts: {
  totalRounds: number;
  matchesPerRound: number;
  leagueWeeks: number;
  daysPerWeek: number;
  matchesPerDay?: number;
}): SchedulePlan {
  const { totalRounds, matchesPerRound, leagueWeeks, daysPerWeek } = opts;

  if (totalRounds === 0) {
    return { feasible: true, matchesPerDay: 1, suggestedMatchesPerDay: 1, totalMatches: 0, weeks: [] };
  }

  // The busiest week under the ceil-of-remaining split holds at most this
  // many rounds, which is what the per-day load must absorb.
  const busyWeekRounds = Math.ceil(totalRounds / Math.max(1, leagueWeeks));
  const suggestedMatchesPerDay = Math.max(1, Math.ceil((busyWeekRounds * matchesPerRound) / daysPerWeek));

  let matchesPerDay: number;
  let minWeeks: number | undefined;

  if (opts.matchesPerDay) {
    matchesPerDay = opts.matchesPerDay;
    const roundsPerWeekCapacity = Math.floor((daysPerWeek * matchesPerDay) / matchesPerRound);
    minWeeks = roundsPerWeekCapacity > 0 ? Math.ceil(totalRounds / roundsPerWeekCapacity) : Infinity;
    if (leagueWeeks < minWeeks) {
      const reason = roundsPerWeekCapacity === 0
        ? `${matchesPerRound} matches per round cannot fit into ${daysPerWeek} day(s) at max ${matchesPerDay} match(es)/day`
        : `${totalRounds} round(s) need at least ${minWeeks} week(s) at ${matchesPerDay} match(es)/day over ${daysPerWeek} day(s)`;
      return { feasible: false, reason, matchesPerDay, suggestedMatchesPerDay, minWeeks, totalMatches: totalRounds * matchesPerRound, weeks: [] };
    }
  } else {
    matchesPerDay = suggestedMatchesPerDay;
  }

  // Simulate the exact placement the generator will perform, so the plan
  // and the produced fixtures can never disagree.
  const weeks: WeekPlan[] = [];
  let roundsPlaced = 0;
  let totalMatches = 0;

  for (let week = 0; week < leagueWeeks && roundsPlaced < totalRounds; week++) {
    const weeksLeft = leagueWeeks - week;
    const roundsThisWeek = Math.ceil((totalRounds - roundsPlaced) / weeksLeft);
    const poolSize = roundsThisWeek * matchesPerRound;
    const perDay: number[] = [];
    let remaining = poolSize;

    for (let d = 0; d < daysPerWeek && remaining > 0; d++) {
      const onDay = Math.min(matchesPerDay, remaining);
      perDay.push(onDay);
      remaining -= onDay;
    }

    if (remaining > 0) {
      return {
        feasible: false,
        reason: `Week ${week + 1} cannot hold ${poolSize} match(es) at ${matchesPerDay} match(es)/day over ${daysPerWeek} day(s)`,
        matchesPerDay,
        suggestedMatchesPerDay,
        minWeeks,
        totalMatches: totalRounds * matchesPerRound,
        weeks,
      };
    }

    weeks.push({ week: week + 1, roundCount: roundsThisWeek, matchCount: poolSize, perDay });
    totalMatches += poolSize;
    roundsPlaced += roundsThisWeek;
  }

  return { feasible: true, matchesPerDay, suggestedMatchesPerDay, minWeeks, totalMatches, weeks };
}
