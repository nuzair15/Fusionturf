import type { FixtureLineupPlayer } from "@/types/lineup";

/**
 * Detect a formation from the starters' y-positions, excluding the goalkeeper.
 * Rows are ordered from own goal to opposition goal (defenders first).
 * `reverseRows` must be true for the team defending the top half of the pitch.
 */
export function calculateFormation(starters: FixtureLineupPlayer[], reverseRows = false): string | null {
  const outfield = starters.filter((p) => !p.isGoalkeeper);
  if (outfield.length < 2) return null;

  const sorted = [...outfield].sort((a, b) =>
    reverseRows ? b.yPosition - a.yPosition : a.yPosition - b.yPosition
  );

  const threshold = Math.max(10, (100 / Math.max(1, sorted.length)) * 0.75);
  const bands: number[] = [];
  let current: FixtureLineupPlayer[] = [];

  for (const player of sorted) {
    if (current.length === 0 || Math.abs(player.yPosition - current[current.length - 1].yPosition) <= threshold) {
      current.push(player);
    } else {
      bands.push(current.length);
      current = [player];
    }
  }
  if (current.length > 0) bands.push(current.length);

  return bands.length === 0 ? null : bands.join("-");
}
