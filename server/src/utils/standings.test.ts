import { describe, expect, it } from "vitest";
import { rankStandings } from "./standings.js";

describe("rankStandings", () => {
  it("does not reverse a two-team head-to-head winner", () => {
    const stats = { a: { pts: 6, gd: 0, gf: 2 }, b: { pts: 6, gd: 4, gf: 5 } };
    expect(rankStandings(["a", "b"], stats, [{ homeTeamId: "a", awayTeamId: "b", homeScore: 1, awayScore: 0 }])).toEqual(["a", "b"]);
  });

  it("does not use overall goal difference when head-to-head is drawn", () => {
    const stats = { a: { pts: 6, gd: 1, gf: 3 }, b: { pts: 6, gd: 3, gf: 4 } };
    expect(rankStandings(["a", "b"], stats, [{ homeTeamId: "a", awayTeamId: "b", homeScore: 1, awayScore: 1 }])).toEqual(["a", "b"]);
  });

  it("uses head-to-head goal difference even when head-to-head points disagree", () => {
    const stats = { a: { pts: 9, gd: -5, gf: 8 }, b: { pts: 9, gd: 8, gf: 12 } };
    const fixtures = [
      { homeTeamId: "a", awayTeamId: "b", homeScore: 5, awayScore: 0 },
      { homeTeamId: "b", awayTeamId: "a", homeScore: 1, awayScore: 0 },
      { homeTeamId: "b", awayTeamId: "a", homeScore: 1, awayScore: 0 },
    ];
    expect(rankStandings(["a", "b"], stats, fixtures)).toEqual(["a", "b"]);
  });

  it("builds a mini-table across a three-team tie", () => {
    const stats = { a: { pts: 9, gd: 0, gf: 4 }, b: { pts: 9, gd: 0, gf: 4 }, c: { pts: 9, gd: 0, gf: 4 } };
    const fixtures = [
      { homeTeamId: "a", awayTeamId: "b", homeScore: 2, awayScore: 0 },
      { homeTeamId: "b", awayTeamId: "c", homeScore: 1, awayScore: 0 },
      { homeTeamId: "c", awayTeamId: "a", homeScore: 1, awayScore: 0 },
    ];
    expect(rankStandings(["a", "b", "c"], stats, fixtures)).toEqual(["a", "c", "b"]);
  });
});
