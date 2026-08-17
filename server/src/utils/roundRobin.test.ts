import { describe, it, expect } from "vitest";
import { generateRoundRobinPairings, requiredLeagueWeeks } from "./roundRobin.js";

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
