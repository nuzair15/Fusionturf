import { describe, expect, it } from "vitest";
import { assignGroups, roundRobin, seededPairs, standings } from "./tournament-format.js";

describe("independent tournament scheduling", () => {
  it("creates every pair exactly once for even and odd team counts", () => {
    for (const ids of [["a", "b", "c", "d"], ["a", "b", "c", "d", "e"]]) {
      const fixtures = roundRobin(ids);
      const pairs = fixtures.map(f => [f.homeTeamId, f.awayTeamId].sort().join(":"));
      expect(fixtures).toHaveLength(ids.length * (ids.length - 1) / 2);
      expect(new Set(pairs).size).toBe(pairs.length);
      expect(fixtures.every(f => f.homeTeamId !== f.awayTeamId)).toBe(true);
    }
  });

  it("reverses home and away in the second leg", () => {
    const fixtures = roundRobin(["a", "b", "c"], 2);
    expect(fixtures).toHaveLength(6);
    for (const first of fixtures.filter(f => f.round <= 3)) {
      expect(fixtures.some(second => second.round > 3 && second.homeTeamId === first.awayTeamId && second.awayTeamId === first.homeTeamId)).toBe(true);
    }
  });

  it("spreads seeded teams across groups and gives odd knockout fields a bye", () => {
    const groups = assignGroups(Array.from({ length: 7 }, (_, i) => ({ id: String(i) })), 3);
    expect([...groups.values()].filter(group => group === "A")).toHaveLength(3);
    expect([...groups.values()].filter(group => group === "B")).toHaveLength(2);
    expect([...groups.values()].filter(group => group === "C")).toHaveLength(2);
    expect(seededPairs(["a", "b", "c"], 1, "KNOCKOUT")).toEqual([{ homeTeamId: "a", awayTeamId: "c", round: 1, stage: "KNOCKOUT" }]);
  });

  it("ranks only completed results and awards three points for a win", () => {
    const rows = standings(["a", "b", "c"], [
      { homeTeamId: "a", awayTeamId: "b", homeScore: 2, awayScore: 1, status: "COMPLETED" },
      { homeTeamId: "b", awayTeamId: "c", homeScore: 1, awayScore: 1, status: "COMPLETED" },
      { homeTeamId: "c", awayTeamId: "a", homeScore: 5, awayScore: 0, status: "SCHEDULED" },
    ]);
    expect(rows.map(row => [row.teamId, row.points])).toEqual([["a", 3], ["c", 1], ["b", 1]]);
    expect(rows.find(row => row.teamId === "c")?.played).toBe(1);
  });
});
