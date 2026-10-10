import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const url = process.env.TOURNAMENT_TEST_DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Tournament integration tests require an isolated local *_test database");
    process.env.DATABASE_URL = url;
  }
});
import prisma from "../config/database.js";
import { liveAction, liveStats } from "./tournament-live.js";

describe.skipIf(!process.env.TOURNAMENT_TEST_DATABASE_URL)("tournament live match isolation on PostgreSQL", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("starts without lineups, records events, pauses at half time and keeps league records untouched", async () => {
    const before = { teams: await prisma.team.count(), players: await prisma.player.count(), fixtures: await prisma.fixture.count() };
    const tournament = await prisma.tournament.create({ data: { name: "Isolated cup", slug: `isolated-${crypto.randomUUID()}`, format: "SINGLE_ELIMINATION", status: "PUBLISHED", lineupSize: 3 } });
    try {
      const [home, away] = await Promise.all(["Home", "Away"].map(name => prisma.tournamentTeam.create({ data: { tournamentId: tournament.id, name } })));
      const homePlayers = await Promise.all(["One", "Two", "Three"].map((firstName, jerseyNumber) => prisma.tournamentPlayer.create({ data: { tournamentId: tournament.id, teamId: home.id, firstName, lastName: "Home", jerseyNumber: jerseyNumber + 1 } })));
      const awayPlayers = await Promise.all(["Four", "Five", "Six"].map((firstName, jerseyNumber) => prisma.tournamentPlayer.create({ data: { tournamentId: tournament.id, teamId: away.id, firstName, lastName: "Away", jerseyNumber: jerseyNumber + 1 } })));
      const fixture = await prisma.tournamentFixture.create({ data: { tournamentId: tournament.id, homeTeamId: home.id, awayTeamId: away.id, stage: "KNOCKOUT", kickoffAt: new Date("2026-10-10T15:00:00Z") } });
      await liveAction(fixture.id, { action: "setStatus", status: "LIVE" }, "test-admin");
      expect((await liveStats(fixture.id)).fixture.status).toBe("LIVE");
      await liveAction(fixture.id, { action: "setStatus", status: "PAUSED" }, "test-admin");
      await prisma.tournamentLineup.createMany({ data: [
        ...homePlayers.map(player => ({ fixtureId: fixture.id, teamId: home.id, playerId: player.id, isStarter: true })),
        ...awayPlayers.map(player => ({ fixtureId: fixture.id, teamId: away.id, playerId: player.id, isStarter: true })),
      ] });
      await liveAction(fixture.id, { action: "setStatus", status: "LIVE" }, "test-admin");
      const goal = await liveAction(fixture.id, { action: "addGoal", teamId: home.id, scorerId: homePlayers[0].id, assistId: homePlayers[1].id, minute: 4 }, "test-admin") as { id: string };
      expect((await liveStats(fixture.id)).fixture.homeScore).toBe(1);
      expect((await liveStats(fixture.id)).matchStats.assists).toHaveLength(1);
      await liveAction(fixture.id, { action: "removeEvent", type: "goal", eventId: goal.id }, "test-admin");
      const afterRemoval = await liveStats(fixture.id);
      expect(afterRemoval.fixture.homeScore).toBe(0);
      expect(afterRemoval.matchStats.assists).toHaveLength(0);
      await liveAction(fixture.id, { action: "addGoal", teamId: away.id, scorerId: awayPlayers[0].id, minute: 18, isOwnGoal: true }, "test-admin");
      expect((await liveStats(fixture.id)).fixture.homeScore).toBe(1);
      await liveAction(fixture.id, { action: "setStatus", status: "HALF_TIME" }, "test-admin");
      expect((await liveStats(fixture.id)).fixture.status).toBe("HALF_TIME");
      await liveAction(fixture.id, { action: "setStatus", status: "LIVE" }, "test-admin");
      await liveAction(fixture.id, { action: "setStatus", status: "COMPLETED" }, "test-admin");
      expect((await liveStats(fixture.id)).fixture.winnerTeamId).toBe(home.id);
      expect(await prisma.team.count()).toBe(before.teams);
      expect(await prisma.player.count()).toBe(before.players);
      expect(await prisma.fixture.count()).toBe(before.fixtures);
    } finally {
      await prisma.tournamentFixture.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.tournament.delete({ where: { id: tournament.id } });
    }
  }, 30_000);
});
