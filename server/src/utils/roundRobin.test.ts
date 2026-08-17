import { describe, it, expect } from "vitest";
import { generateRoundRobinPairings, normalizeFixtureDays, planFixtureSchedule, requiredLeagueWeeks } from "./roundRobin.js";

// A season's full round list, home-and-away when requested — same shape the
// generator feeds the planner (FixtureSlot[][]).
function seasonRounds(teamCount: number, matchesPerPair: number) {
  const first = generateRoundRobinPairings(teamCount);
  const second = matchesPerPair >= 2
    ? first.map((r) => r.map((f) => ({ homeTeamIdx: f.awayTeamIdx, awayTeamIdx: f.homeTeamIdx })))
    : [];
  return [...first, ...second];
}

describe("generateRoundRobinPairings", () => {
  it("gives every team exactly one fixture per round for an even team count", () => {
    const rounds = generateRoundRobinPairings(6);
    for (const round of rounds) {
      const teamsInRound = round.flatMap((f) => [f.homeTeamIdx, f.awayTeamIdx]);
      expect(teamsInRound.length).toBe(new Set(teamsInRound).size); // no team plays twice in one round
      expect(teamsInRound.length).toBe(6); // all 6 teams play every round
    }
  });

  it("produces (teamCount - 1) rounds for an even team count", () => {
    // A single round-robin among 6 teams needs 5 rounds — this is the
    // number that requiredLeagueWeeks doubles for a home-and-away season.
    expect(generateRoundRobinPairings(6).length).toBe(5);
  });

  it("pairs every team against every other team exactly once", () => {
    const rounds = generateRoundRobinPairings(6);
    const pairings = new Set<string>();
    for (const round of rounds) {
      for (const f of round) {
        const key = [f.homeTeamIdx, f.awayTeamIdx].sort().join("-");
        expect(pairings.has(key)).toBe(false); // no pairing repeats
        pairings.add(key);
      }
    }
    // 6 teams -> C(6,2) = 15 unique pairings across the whole single round-robin
    expect(pairings.size).toBe(15);
  });
});

describe("normalizeFixtureDays", () => {
  // A bad day name (typo or abbreviation) used to reach findNextDay, which
  // silently returned the week's start date: the first fixture day looked
  // skipped and a bad name later in the list double-booked that date.
  it("keeps valid full weekday names in order, case-insensitive", () => {
    expect(normalizeFixtureDays(["Friday", "saturday", "SUNDAY"])).toEqual({ days: ["friday", "saturday", "sunday"], invalid: [] });
  });

  it("collects invalid names instead of letting them corrupt dates", () => {
    const result = normalizeFixtureDays(["Fri", "Saturday", "fridayy", "Sunday"]);
    expect(result.days).toEqual(["saturday", "sunday"]);
    expect(result.invalid).toEqual(["Fri", "fridayy"]);
  });

  it("drops duplicate days so a day can never be counted twice", () => {
    expect(normalizeFixtureDays(["Friday", "Sunday", "friday"])).toEqual({ days: ["friday", "sunday"], invalid: [] });
  });

  it("ignores empty entries", () => {
    expect(normalizeFixtureDays(["", "Friday", " ", "Sunday"])).toEqual({ days: ["friday", "sunday"], invalid: [] });
  });

  it("yields an empty day list when nothing valid is given", () => {
    expect(normalizeFixtureDays([])).toEqual({ days: [], invalid: [] });
  });
});

describe("requiredLeagueWeeks", () => {
  // This is the number that used to be hardcoded as a stale default (7)
  // instead of computed — the mismatch let generateSeasonFixtures silently
  // drop 3 rounds (9 fixtures) of a 6-team double round-robin. These cases
  // pin down what the correct number actually is so that regression can't
  // come back unnoticed.
  it("needs 10 weeks for 6 teams playing home and away", () => {
    expect(requiredLeagueWeeks(6, 2)).toBe(10);
  });

  it("needs 5 weeks for 6 teams playing once each", () => {
    expect(requiredLeagueWeeks(6, 1)).toBe(5);
  });

  it("needs 8 weeks for 8 teams playing home and away", () => {
    expect(requiredLeagueWeeks(8, 2)).toBe(14);
  });

  it("accounts for the extra 'bye' round an odd team count needs", () => {
    // With an odd number of teams, one team sits out each round, so a
    // single leg takes `teamCount` rounds instead of `teamCount - 1`.
    expect(requiredLeagueWeeks(5, 1)).toBe(5);
  });
});

describe("planFixtureSchedule", () => {
  // The config a user originally reported as failing: 5 teams playing home
  // and away (10 rounds of 2 matches), max 2 matches/day over 3 fixture
  // days. Odd team counts need two rounds a week so each round's bye team
  // still plays in the other round, so 5 weeks is the longest this can run
  // while every team plays every week.
  it("fits the reported 5-team / 2-per-day config with every team playing every week", () => {
    const plan = planFixtureSchedule({ rounds: seasonRounds(5, 2), leagueWeeks: 5, daysPerWeek: 3, matchesPerDay: 2 });
    expect(plan.feasible).toBe(true);
    expect(plan.matchesPerDay).toBe(2);
    expect(plan.minWeeks).toBe(4);
    expect(plan.totalMatches).toBe(20);
    const placed = plan.weeks.reduce((sum, w) => sum + w.matchCount, 0);
    expect(placed).toBe(20);
    for (const w of plan.weeks) {
      expect(w.days.length).toBeLessThanOrEqual(3);
      expect(w.perDay.reduce((a, b) => a + b, 0)).toBe(w.matchCount);
      for (const day of w.days) {
        expect(day.length).toBeLessThanOrEqual(2);
        const teams = day.flatMap((x) => [x.slot.homeTeamIdx, x.slot.awayTeamIdx]);
        expect(new Set(teams).size).toBe(teams.length); // one match per team per day
      }
      const teamsInWeek = new Set<number>();
      for (const day of w.days) for (const x of day) { teamsInWeek.add(x.slot.homeTeamIdx); teamsInWeek.add(x.slot.awayTeamIdx); }
      expect(teamsInWeek.size).toBe(5); // every team plays every week
    }
  });

  it("rejects weeks that would leave a team without a match", () => {
    // 5 teams / 10 rounds over 7 weeks: weeks 1-3 hold 2 rounds, weeks 4-7
    // hold 1 — each single-round week lets its bye team rest the whole week.
    const plan = planFixtureSchedule({ rounds: seasonRounds(5, 2), leagueWeeks: 7, daysPerWeek: 3, matchesPerDay: 2 });
    expect(plan.feasible).toBe(false);
    expect(plan.reason).toMatch(/at least 1 match per week/);
  });

  it("rejects trailing weeks with no matches at all", () => {
    // 6 teams / 10 rounds over 12 weeks: the season ends after week 10, so
    // nobody plays weeks 11-12.
    const plan = planFixtureSchedule({ rounds: seasonRounds(6, 2), leagueWeeks: 12, daysPerWeek: 3 });
    expect(plan.feasible).toBe(false);
    expect(plan.reason).toMatch(/finish after week 10/);
  });

  it("rejects a week count a matches-per-day cap genuinely cannot hold", () => {
    // 6 teams double round-robin: 10 rounds of 3 matches. At 2/day over
    // 3 days a week holds 6 matches, so 5 weeks is the floor — 4 must fail.
    const plan = planFixtureSchedule({ rounds: seasonRounds(6, 2), leagueWeeks: 4, daysPerWeek: 3, matchesPerDay: 2 });
    expect(plan.feasible).toBe(false);
    expect(plan.minWeeks).toBe(5);
    expect(plan.reason).toMatch(/at least 5 week/);
  });

  it("clamps a matches-per-day cap to what a day can legally hold", () => {
    // 5 teams, single leg in 4 rounds over ONE week and ONE day: a day can
    // legally hold at most floor(5/2) = 2 matches (any more would force a
    // team to play twice). The old count-only math accepted 4/day and
    // promised a schedule the team constraint made impossible.
    const plan = planFixtureSchedule({ rounds: seasonRounds(5, 1).slice(0, 4), leagueWeeks: 1, daysPerWeek: 1, matchesPerDay: 4 });
    expect(plan.matchesPerDay).toBe(2);
    expect(plan.feasible).toBe(false);
    expect(plan.minWeeks).toBe(4);
  });

  it("rejects a week count that would force a team to play twice in one day", () => {
    // 6 teams, 10 rounds into 2 weeks over 3 days: 15 matches/week over 9
    // legal day slots (max 3/day). The old planner reported this as feasible
    // at 5 matches/day; the team-once-per-day rule makes it impossible.
    const plan = planFixtureSchedule({ rounds: seasonRounds(6, 2), leagueWeeks: 2, daysPerWeek: 3 });
    expect(plan.feasible).toBe(false);
    expect(plan.reason).toMatch(/twice on the same day/);
  });

  it("packs multiple rounds per week when no cap is set", () => {
    // 6 teams, 10 rounds into 4 weeks over 3 days: 3 rounds/week = 9
    // matches/week, exactly one day's legal capacity (3/day) each day.
    const plan = planFixtureSchedule({ rounds: seasonRounds(6, 2), leagueWeeks: 4, daysPerWeek: 3 });
    expect(plan.feasible).toBe(true);
    expect(plan.matchesPerDay).toBe(3);
    expect(plan.totalMatches).toBe(30);
  });

  it("never schedules a team twice on one day, even across packed rounds", () => {
    // 6 teams, 10 rounds into 5 weeks over 3 days at cap 2: every week
    // holds 2 rounds, and the second round's reversed pairings must move to
    // a later day rather than replay on the first round's day (team 0, 1, 2,
    // 3, 4, 5 all get exactly one match per day).
    const plan = planFixtureSchedule({ rounds: seasonRounds(6, 2), leagueWeeks: 5, daysPerWeek: 3, matchesPerDay: 2 });
    expect(plan.feasible).toBe(true);
    const placed = plan.weeks.reduce((sum, w) => sum + w.matchCount, 0);
    expect(placed).toBe(30);
    for (const w of plan.weeks) {
      expect(w.roundCount).toBe(2);
      for (const day of w.days) {
        const teams = day.flatMap((x) => [x.slot.homeTeamIdx, x.slot.awayTeamIdx]);
        expect(new Set(teams).size).toBe(teams.length);
        expect(day.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("never disagrees with actual placement across a sweep of configs", () => {
    for (let teamCount = 4; teamCount <= 12; teamCount++) {
      const maxLegalPerDay = Math.floor(teamCount / 2);
      for (const matchesPerPair of [1, 2]) {
        const rounds = seasonRounds(teamCount, matchesPerPair);
        const totalMatches = rounds.reduce((sum, r) => sum + r.length, 0);
        for (let leagueWeeks = 1; leagueWeeks <= 10; leagueWeeks++) {
          for (let daysPerWeek = 1; daysPerWeek <= 4; daysPerWeek++) {
            for (const cap of [undefined, 1, 2, 3, 4]) {
              const effectiveCap = cap ? Math.min(cap, maxLegalPerDay) : undefined;
              const plan = planFixtureSchedule({ rounds, leagueWeeks, daysPerWeek, matchesPerDay: cap });
              if (plan.feasible) {
                // Every fixture is placed, day loads respect the effective
                // cap, no team ever plays twice on one day, and every team
                // plays at least once every week (no trailing idle weeks).
                const placed = plan.weeks.reduce((sum, w) => sum + w.matchCount, 0);
                expect(placed).toBe(totalMatches);
                expect(plan.weeks.length).toBe(leagueWeeks);
                for (const w of plan.weeks) {
                  expect(w.perDay.reduce((a, b) => a + b, 0)).toBe(w.matchCount);
                  expect(w.days.length).toBeLessThanOrEqual(daysPerWeek);
                  for (const day of w.days) {
                    const teams = day.flatMap((x) => [x.slot.homeTeamIdx, x.slot.awayTeamIdx]);
                    expect(new Set(teams).size).toBe(teams.length);
                    expect(teams.length).toBeGreaterThan(0);
                    expect(day.length).toBeLessThanOrEqual(effectiveCap ?? maxLegalPerDay);
                  }
                  const teamsInWeek = new Set<number>();
                  const weekKeys = new Set<string>();
                  for (const day of w.days) for (const x of day) {
                    teamsInWeek.add(x.slot.homeTeamIdx);
                    teamsInWeek.add(x.slot.awayTeamIdx);
                    const key = `${x.slot.homeTeamIdx}v${x.slot.awayTeamIdx}`;
                    expect(weekKeys.has(key)).toBe(false); // no match scheduled twice
                    weekKeys.add(key);
                  }
                  expect(weekKeys.size).toBe(w.matchCount);
                  expect(teamsInWeek.size).toBe(teamCount);
                }
                // Feasibility implies the upfront capacity check passes.
                if (effectiveCap) {
                  const roundsPerWeekCapacity = Math.floor((daysPerWeek * effectiveCap) / maxLegalPerDay);
                  const minWeeks = roundsPerWeekCapacity > 0 ? Math.ceil(rounds.length / roundsPerWeekCapacity) : Infinity;
                  expect(leagueWeeks).toBeGreaterThanOrEqual(minWeeks);
                }
              } else {
                // Upfront cap rejections must carry the minWeeks explanation.
                if (effectiveCap) {
                  const roundsPerWeekCapacity = Math.floor((daysPerWeek * effectiveCap) / maxLegalPerDay);
                  const minWeeks = roundsPerWeekCapacity > 0 ? Math.ceil(rounds.length / roundsPerWeekCapacity) : Infinity;
                  if (leagueWeeks < minWeeks) {
                    expect(plan.reason).toMatch(/need at least|cannot fit into/);
                  }
                }
                // Placement-stage rejections (team twice per day, a team
                // missing a week, trailing idle weeks) still say why.
                expect(plan.reason).toBeTruthy();
              }
            }
          }
        }
      }
    }
  });

  it("treats an empty round list as feasible and empty", () => {
    const plan = planFixtureSchedule({ rounds: [], leagueWeeks: 4, daysPerWeek: 3 });
    expect(plan.feasible).toBe(true);
    expect(plan.totalMatches).toBe(0);
    expect(plan.weeks).toEqual([]);
  });
});
