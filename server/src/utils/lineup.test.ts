import { describe, it, expect } from "vitest";
import { calculateFormation, formatPlayerName, type LineupPlayer } from "./lineup.js";

function player(y: number, isGoalkeeper = false): LineupPlayer {
  return {
    id: `p-${y}-${Math.random()}`,
    playerId: "player",
    name: "Test Player",
    jerseyNumber: null,
    avatar: null,
    position: null,
    role: null,
    xPosition: 50,
    yPosition: y,
    isCaptain: false,
    isGoalkeeper,
    isStarter: true,
  };
}

describe("formatPlayerName", () => {
  it("joins first and last name", () => {
    expect(formatPlayerName("Leo", "Messi")).toBe("Leo Messi");
  });
});

describe("calculateFormation", () => {
  it("excludes the goalkeeper from the formation string", () => {
    const starters = [
      player(5, true), // GK — should not appear as a band
      player(20), player(25),
      player(50), player(52),
      player(80),
    ];
    // Two defenders, two midfielders, one forward -> "2-2-1"
    expect(calculateFormation(starters)).toBe("2-2-1");
  });

  it("returns null with fewer than 2 outfield players", () => {
    expect(calculateFormation([player(5, true), player(50)])).toBeNull();
  });

  it("reverses band order for the team defending the opposite end", () => {
    const starters = [player(20), player(25), player(50), player(52), player(80)];
    // Same shape, opposite reading direction: closest-to-their-own-goal
    // band (highest y here) should come first when reverseRows is true.
    const normal = calculateFormation(starters, false);
    const reversed = calculateFormation(starters, true);
    expect(normal).toBe("2-2-1");
    expect(reversed).toBe("1-2-2");
  });
});
