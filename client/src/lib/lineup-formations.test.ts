import { describe, expect, it } from "vitest";
import { applySixASideFormation } from "./lineup-formations";
import type { LineupEntryInput } from "@/types/lineup";

const lineup: LineupEntryInput[] = [
  { playerId: "a", isStarter: true, isCaptain: true },
  { playerId: "b", isStarter: true },
  { playerId: "c", isStarter: true, isGoalkeeper: true },
  { playerId: "d", isStarter: true },
  { playerId: "e", isStarter: true },
  { playerId: "f", isStarter: true },
  { playerId: "bench", isStarter: false, xPosition: 17, yPosition: 19 },
];

describe("6-a-side formation selection", () => {
  it("only moves existing starters and preserves captain, keeper, and bench", () => {
    const result = applySixASideFormation(lineup, "home", "1-3-1")!;
    expect(result.map((entry) => entry.playerId)).toEqual(lineup.map((entry) => entry.playerId));
    expect(result.find((entry) => entry.playerId === "a")?.isCaptain).toBe(true);
    expect(result.find((entry) => entry.playerId === "c")).toMatchObject({ isGoalkeeper: true, xPosition: 50, yPosition: 91 });
    expect(result[result.length - 1]).toEqual(lineup[lineup.length - 1]);
  });

  it("does not select or remove players when fewer or more than six starters are chosen", () => {
    expect(applySixASideFormation(lineup.slice(1), "away", "2-2-1")).toBeNull();
    expect(applySixASideFormation([...lineup, { playerId: "g", isStarter: true }], "home", "2-2-1")).toBeNull();
  });
});
