type TeamFixtureWithYellows = { id: string; cards: Array<{ id: string }> };

// A yellow in every one of the last `threshold` team matches triggers the
// next-match ban. A match without a yellow breaks the streak.
export function consecutiveYellowMilestone(fixtures: TeamFixtureWithYellows[], fixtureId: string, threshold: number): number | null {
  const index = fixtures.findIndex((fixture) => fixture.id === fixtureId);
  if (index < 0 || threshold < 1 || index + 1 < threshold) return null;
  const streak = fixtures.slice(index + 1 - threshold, index + 1);
  if (streak.some((fixture) => fixture.cards.length === 0)) return null;
  return fixtures.slice(0, index + 1).reduce((count, fixture) => count + fixture.cards.length, 0);
}
