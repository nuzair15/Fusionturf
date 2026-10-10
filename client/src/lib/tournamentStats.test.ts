import { describe, expect, it } from "vitest";
import { calculateTournamentLeaders } from "./tournamentStats";
import type { Tournament } from "@/types/tournament";

describe("calculateTournamentLeaders", () => {
  it("ranks tournament goals, assists and cards from recorded events", () => {
    const source = {
      teams: [
        { id: "home", name: "Home", logoUrl: "home.png", players: [{ id: "p1", firstName: "Asha", lastName: "One", photoUrl: "asha.png" }, { id: "p2", firstName: "Bea", lastName: "Two", photoUrl: null }] },
        { id: "away", name: "Away", logoUrl: null, players: [{ id: "p3", firstName: "Cara", lastName: "Three", photoUrl: null }] },
      ],
      fixtures: [{ events: [
        { kind: "GOAL", playerId: "p1", playerName: "Asha One", teamId: "home" },
        { kind: "PENALTY_GOAL", playerId: "p1", playerName: "Asha One", teamId: "home" },
        { kind: "OWN_GOAL", playerId: "p3", playerName: "Cara Three", teamId: "away" },
        { kind: "ASSIST", playerId: "p2", playerName: "Bea Two", teamId: "home" },
        { kind: "YELLOW", playerId: "p2", playerName: "Bea Two", teamId: "home" },
        { kind: "SECOND_YELLOW", playerId: "p2", playerName: "Bea Two", teamId: "home" },
        { kind: "RED", playerId: "p3", playerName: "Cara Three", teamId: "away" },
        { kind: "AWARDED_GOAL", playerId: null, playerName: null, teamId: "away" },
      ] }],
    } as unknown as Pick<Tournament, "teams" | "fixtures">;

    const leaders = calculateTournamentLeaders(source);
    expect(leaders.goals).toEqual([expect.objectContaining({ playerName: "Asha One", teamName: "Home", value: 2 })]);
    expect(leaders.assists).toEqual([expect.objectContaining({ playerName: "Bea Two", value: 1 })]);
    expect(leaders.yellowCards).toEqual([expect.objectContaining({ playerName: "Bea Two", value: 2 })]);
    expect(leaders.redCards).toEqual([expect.objectContaining({ playerName: "Cara Three", value: 1 })]);
  });

  it("keeps snapshot names when a player is no longer registered", () => {
    const source = {
      teams: [{ id: "home", name: "Home", logoUrl: null, players: [] }],
      fixtures: [{ events: [{ kind: "GOAL", playerId: null, playerName: "Former Player", teamId: "home" }] }],
    } as unknown as Pick<Tournament, "teams" | "fixtures">;

    expect(calculateTournamentLeaders(source).goals[0]).toMatchObject({ playerName: "Former Player", teamName: "Home", value: 1 });
  });
});
