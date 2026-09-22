import type { LineupEntryInput } from "@/types/lineup";

export const SIX_A_SIDE_FORMATIONS = ["2-2-1", "1-3-1", "2-1-2", "3-1-1", "1-2-2", "1-1-3", "2-3-0", "3-2-0"] as const;
export type SixASideFormation = (typeof SIX_A_SIDE_FORMATIONS)[number];

function sixASidePositions(side: "home" | "away", formation: SixASideFormation) {
  const home = side === "home";
  const rowCounts: Record<SixASideFormation, number[]> = {
    "2-2-1": [2, 2, 1], "1-3-1": [1, 3, 1], "2-1-2": [2, 1, 2],
    "3-1-1": [3, 1, 1], "1-2-2": [1, 2, 2], "1-1-3": [1, 1, 3],
    "2-3-0": [2, 3], "3-2-0": [3, 2],
  };
  const rowY: Record<SixASideFormation, number[]> = {
    "2-2-1": [84, 72, 60], "1-3-1": [84, 72, 60], "2-1-2": [84, 71, 59],
    "3-1-1": [84, 70, 58], "1-2-2": [84, 70, 58], "1-1-3": [84, 70, 58],
    "2-3-0": [84, 68], "3-2-0": [84, 68],
  };
  const positions: Array<{ x: number; y: number }> = [{ x: 50, y: home ? 91 : 9 }];
  rowCounts[formation].forEach((count, rowIndex) => {
    const y = home ? rowY[formation][rowIndex] : 100 - rowY[formation][rowIndex];
    for (let i = 0; i < count; i += 1) positions.push({ x: ((i + 1) / (count + 1)) * 100, y });
  });
  return positions;
}

export function applySixASideFormation(entries: LineupEntryInput[], side: "home" | "away", formation: SixASideFormation) {
  const starters = entries.filter((entry) => entry.isStarter);
  if (starters.length !== 6) return null;

  const goalkeeper = starters.find((entry) => entry.isGoalkeeper);
  const ordered = goalkeeper ? [goalkeeper, ...starters.filter((entry) => entry !== goalkeeper)] : starters;
  const positions = sixASidePositions(side, formation);
  const positionByPlayer = new Map(ordered.map((entry, index) => [entry.playerId, positions[index]]));
  return entries.map((entry) => {
    const position = positionByPlayer.get(entry.playerId);
    return position ? { ...entry, xPosition: position.x, yPosition: position.y } : entry;
  });
}
