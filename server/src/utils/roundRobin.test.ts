import { describe, it, expect } from "vitest";
import { generateRoundRobinPairings, planFixtureSchedule, requiredLeagueWeeks } from "./roundRobin.js";

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
  // The exact configuration a user reported as failing: 5 teams playing
  // home and away (10 rounds of 2 matches), 7 weeks, max 2 matches/day
  // over 3 fixture days. It must be feasible, with the capacity check and
  // the simulated placement agreeing (the two used to drift apart).
  it("fits the reported 5-team / 7-week / 2-per-day configuration", () => {
    const plan = planFixtureSchedule({ totalRounds: 10, matchesPerRound: 2, leagueWeeks: 7, daysPerWeek: 3, matchesPerDay: 2 });
    expect(plan.feasible).toBe(true);
    expect(plan.matchesPerDay).toBe(2);
    expect(plan.minWeeks).toBe(4);
    expect(plan.totalMatches).toBe(20);
    const placed = plan.weeks.reduce((sum, w) => sum + w.matchCount, 0);
    expect(placed).toBe(20);
    for (const w of plan.weeks) {
      expect(w.perDay.reduce((a, b) => a + b, 0)).toBe(w.matchCount);
      for (const day of w.perDay) expect(day).toBeLessThanOrEqual(2);
    }
  });

  it("rejects a week count a matches-per-day cap genuinely cannot hold", () => {
    // 6 teams double round-robin: 10 rounds of 3 matches. At 2/day over
    // 3 days a week holds 6 matches, so 5 weeks is the floor — 4 must fail.
    const plan = planFixtureSchedule({ totalRounds: 10, matchesPerRound: 3, leagueWeeks: 4, daysPerWeek: 3, matchesPerDay: 2 });
    expect(plan.feasible).toBe(false);
    expect(plan.minWeeks).toBe(5);
    expect(plan.reason).toMatch(/at least 5 week/);
  });

  it("packs multiple rounds per week to fit when no cap is set", () => {
    // 10 rounds of 3 matches into 2 weeks over 3 days: 5 rounds/week =
    // 15 matches/week = 5 matches/day.
    const plan = planFixtureSchedule({ totalRounds: 10, matchesPerRound: 3, leagueWeeks: 2, daysPerWeek: 3 });
    expect(plan.feasible).toBe(true);
    expect(plan.matchesPerDay).toBe(5);
    expect(plan.totalMatches).toBe(30);
  });

  it("never disagrees with actual placement across a sweep of configs", () => {
    for (let teamCount = 4; teamCount <= 12; teamCount++) {
      const roundsPerLeg = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
      for (const matchesPerPair of [1, 2]) {
        const totalRounds = roundsPerLeg * matchesPerPair;
        const matchesPerRound = Math.floor(teamCount / 2);
        for (let leagueWeeks = 1; leagueWeeks <= 10; leagueWeeks++) {
          for (let daysPerWeek = 1; daysPerWeek <= 4; daysPerWeek++) {
            for (const cap of [undefined, 1, 2, 3, 4]) {
              const plan = planFixtureSchedule({ totalRounds, matchesPerRound, leagueWeeks, daysPerWeek, matchesPerDay: cap });
              if (plan.feasible) {
                // Every fixture is placed, day loads respect the cap, and
                // per-day counts add up to the week's match count.
                const placed = plan.weeks.reduce((sum, w) => sum + w.matchCount, 0);
                expect(placed).toBe(totalRounds * matchesPerRound);
                for (const w of plan.weeks) {
                  expect(w.perDay.reduce((a, b) => a + b, 0)).toBe(w.matchCount);
                  for (const day of w.perDay) {
                    expect(day).toBeGreaterThan(0);
                    if (cap) expect(day).toBeLessThanOrEqual(cap);
                  }
                }
                // Feasibility implies the upfront capacity check passes.
                if (cap) {
                  const roundsPerWeekCapacity = Math.floor((daysPerWeek * cap) / matchesPerRound);
                  const minWeeks = roundsPerWeekCapacity > 0 ? Math.ceil(totalRounds / roundsPerWeekCapacity) : Infinity;
                  expect(leagueWeeks).toBeGreaterThanOrEqual(minWeeks);
                }
              } else {
                // Infeasibility must always be explainable by minWeeks.
                expect(plan.minWeeks).toBeDefined();
                if (plan.minWeeks && plan.minWeeks !== Infinity) {
                  expect(leagueWeeks).toBeLessThan(plan.minWeeks);
                }
              }
            }
          }
        }
      }
    }
  });
});
