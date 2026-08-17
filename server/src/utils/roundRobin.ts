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

export const WEEK_DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Normalize a raw fixture-day list (user typed or stored on a season) to
 * canonical lowercase weekday names, keeping order and dropping duplicates.
 * Invalid names are returned separately so callers can surface them — a bad
 * day name used to fall through to `findNextDay`, which silently mapped it
 * to the week's start date: the first fixture day then looked "skipped",
 * and a bad name later in the list stacked matches onto that same first
 * date (the "counts it twice" report).
 */
export function normalizeFixtureDays(raw: string[]): { days: string[]; invalid: string[] } {
  const days: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const name = entry.trim().toLowerCase();
    if (!name) continue;
    if (!WEEK_DAY_KEYS.includes(name)) {
      invalid.push(entry.trim());
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    days.push(name);
  }
  return { days, invalid };
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

export interface PlacedSlot {
  slot: FixtureSlot;
  /** 1-based round number this fixture belongs to. */
  round: number;
}

export interface WeekPlan {
  week: number;
  roundCount: number;
  matchCount: number;
  /** Matches assigned to each fixture day of this week, in day order. A team
   * never appears twice in the same day's array — one match per day max. */
  days: PlacedSlot[][];
  /** Matches per day as counts (parallel to `days`), for preview consumers. */
  perDay: number[];
}

export interface SchedulePlan {
  feasible: boolean;
  /** Why the plan is infeasible, when it is. */
  reason?: string;
  /** The effective matches-per-day limit the schedule will actually use. */
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
 * Rounds are split across weeks evenly (ceil of remaining / weeks left).
 * Matches are then placed day by day with two hard rules:
 *  - at most `matchesPerDay` per day (or as many as the round count needs,
 *    when no cap is set — the generator packs to fit the requested weeks)
 *  - a team never plays twice on the same day — this is what the old
 *    count-only math missed: it could schedule a team into two matches on
 *    one date (and skip a fixture day doing so)
 *
 * The placement is greedy (first eligible match in round order per day).
 * With a cap, infeasible week counts are reported up front; anything the
 * greedy pass cannot place is reported as infeasible instead of silently
 * dropping fixtures.
 */
export function planFixtureSchedule(opts: {
  rounds: FixtureSlot[][];
  leagueWeeks: number;
  daysPerWeek: number;
  matchesPerDay?: number;
}): SchedulePlan {
  const { rounds, leagueWeeks, daysPerWeek } = opts;

  const totalRounds = rounds.length;
  if (totalRounds === 0) {
    return { feasible: true, matchesPerDay: 1, suggestedMatchesPerDay: 1, totalMatches: 0, weeks: [] };
  }

  // Team-once-per-day caps a single day at floor(teams/2) matches — i.e. the
  // size of the largest round. No cap option can raise that.
  const maxRoundMatches = Math.max(...rounds.map((r) => r.length));
  const maxLegalPerDay = maxRoundMatches;

  // The busiest week under the ceil-of-remaining split holds at most this
  // many rounds, which is what the per-day load must absorb.
  const busyWeekRounds = Math.ceil(totalRounds / Math.max(1, leagueWeeks));
  const suggestedMatchesPerDay = Math.min(maxLegalPerDay, Math.max(1, Math.ceil((busyWeekRounds * maxRoundMatches) / daysPerWeek)));

  // Effective per-day load: the user's cap, clamped to what a day can
  // legally hold (each team once), or the auto suggestion when unset.
  let matchesPerDay: number;
  let minWeeks: number | undefined;

  if (opts.matchesPerDay) {
    matchesPerDay = Math.min(opts.matchesPerDay, maxLegalPerDay);
    const roundsPerWeekCapacity = Math.floor((daysPerWeek * matchesPerDay) / maxRoundMatches);
    minWeeks = roundsPerWeekCapacity > 0 ? Math.ceil(totalRounds / roundsPerWeekCapacity) : Infinity;
    if (leagueWeeks < minWeeks) {
      const reason = roundsPerWeekCapacity === 0
        ? `${maxRoundMatches} matches per round cannot fit into ${daysPerWeek} day(s) at max ${matchesPerDay} match(es)/day`
        : `${totalRounds} round(s) need at least ${minWeeks} week(s) at ${matchesPerDay} match(es)/day over ${daysPerWeek} day(s)`;
      return { feasible: false, reason, matchesPerDay, suggestedMatchesPerDay, minWeeks, totalMatches: totalRounds * maxRoundMatches, weeks: [] };
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

    const pool: PlacedSlot[] = [];
    for (let r = 0; r < roundsThisWeek; r++) {
      for (const slot of rounds[roundsPlaced + r]) {
        pool.push({ slot, round: roundsPlaced + r + 1 });
      }
    }

    const days: PlacedSlot[][] = [];
    let unplaced = pool.length;

    for (let d = 0; d < daysPerWeek && unplaced > 0; d++) {
      const day: PlacedSlot[] = [];
      const teamsToday = new Set<number>();
      for (const item of pool) {
        if (unplaced === 0 || day.length >= matchesPerDay) break;
        if (teamsToday.has(item.slot.homeTeamIdx) || teamsToday.has(item.slot.awayTeamIdx)) continue;
        day.push(item);
        teamsToday.add(item.slot.homeTeamIdx);
        teamsToday.add(item.slot.awayTeamIdx);
        unplaced--;
      }
      days.push(day);
    }

    if (unplaced > 0) {
      return {
        feasible: false,
        reason: `Week ${week + 1} cannot fit ${pool.length} match(es) across ${daysPerWeek} day(s) without a team playing twice on the same day — add fixture days or more weeks.`,
        matchesPerDay,
        suggestedMatchesPerDay,
        minWeeks,
        totalMatches: totalRounds * maxRoundMatches,
        weeks,
      };
    }

    weeks.push({
      week: week + 1,
      roundCount: roundsThisWeek,
      matchCount: pool.length,
      days,
      perDay: days.map((d) => d.length),
    });
    totalMatches += pool.length;
    roundsPlaced += roundsThisWeek;
  }

  return { feasible: true, matchesPerDay, suggestedMatchesPerDay, minWeeks, totalMatches, weeks };
}
