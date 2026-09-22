import { describe, expect, it } from "vitest";
import { calculateHistoricalPlayerStats } from "./historical-player-stats.js";

const fixture = (id: string, team: string, player: string) => ({ id, homeTeamId: team, awayTeamId: "opponent", matchDate: new Date("2026-01-01"), homeScore: 1, awayScore: 0, lineups: [{ playerId: player, teamId: team, isStarter: true }], appearances: [], matchdaySquads: [], substitutions: [], goals: [{ playerId: player, teamId: team, isOwnGoal: false }], assists: [], cards: [], shots: [], matchPlayerRatings: [] });
describe("historical player statistics", () => {
  it("keeps performance with the team represented even after transfer and inactivity", () => {
    const rows = calculateHistoricalPlayerStats([{ id: "player", teamId: "new", isActive: false }], [fixture("first", "old", "player"), fixture("second", "new", "player")]);
    expect(rows.find(r => r.teamId === "old")).toMatchObject({ goals: 1, appearances: 1, minutesPlayed: 60 });
    expect(rows.find(r => r.teamId === "new")).toMatchObject({ goals: 1, appearances: 1, minutesPlayed: 60 });
  });
  it("does not double-count starters also recorded as appearances", () => {
    const f = fixture("one", "team", "player");
    const rows = calculateHistoricalPlayerStats([{ id: "player", teamId: "team" }], [{ ...f, appearances: [{ playerId: "player", teamId: "team", isStarter: true }] }]);
    expect(rows[0].appearances).toBe(1);
  });
  it("does not invent an appearance from a goal alone", () => {
    const f = fixture("one", "team", "player");
    const rows = calculateHistoricalPlayerStats([{ id: "player", teamId: "team" }], [{ ...f, lineups: [] }]);
    expect(rows[0]).toMatchObject({ goals: 1, appearances: 0 });
  });
  it("clears derived numbers after corrected events disappear without dropping the old team row", () => {
    const rows = calculateHistoricalPlayerStats([{ id: "player", teamId: "new" }], [], [{ playerId: "player", teamId: "old", goals: 3 }]);
    expect(rows.find(r => r.teamId === "old")).toMatchObject({ goals: 0, appearances: 0 });
  });
});
