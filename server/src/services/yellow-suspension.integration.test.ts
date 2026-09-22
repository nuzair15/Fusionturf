import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const url = process.env.SEASON_TEST_DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Yellow suspension tests require an isolated local database ending in _test");
    process.env.DATABASE_URL = url;
  }
});
import prisma from "../config/database.js";
import { processSuspensions } from "./league-system.js";
import { assertPlayerEligibility } from "./player-eligibility.js";
import { getFixtureLineupEligibility, updateFixtureStatus } from "../controllers/admin/fixtures.js";

describe.skipIf(!process.env.SEASON_TEST_DATABASE_URL)("yellow suspensions on PostgreSQL", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("requires yellows in consecutive team matches and blocks an already-saved next lineup", async () => {
    const suffix = crypto.randomUUID();
    const season = await prisma.season.create({ data: { name: "Cards test", slug: `cards-${suffix}`, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
    const home = await prisma.team.create({ data: { seasonId: season.id, name: "Home", slug: `home-${suffix}` } });
    const away = await prisma.team.create({ data: { seasonId: season.id, name: "Away", slug: `away-${suffix}` } });
    const player = await prisma.player.create({ data: { seasonId: season.id, teamId: home.id, firstName: "Cards", lastName: "Player", slug: `cards-player-${suffix}` } });

    const completed = async (day: number, yellow: boolean) => {
      const fixture = await prisma.fixture.create({ data: { seasonId: season.id, homeTeamId: home.id, awayTeamId: away.id, matchDate: new Date(`2026-03-${String(day).padStart(2, "0")}`), status: "COMPLETED" } });
      if (yellow) await prisma.card.create({ data: { fixtureId: fixture.id, playerId: player.id, teamId: home.id, type: "YELLOW", minute: 20 } });
      await processSuspensions(fixture.id);
      return fixture;
    };

    await completed(1, true);
    await completed(2, false);
    await completed(3, true);
    expect(await prisma.suspension.count({ where: { playerId: player.id } })).toBe(0);
    const fourth = await completed(4, true);
    await processSuspensions(fourth.id);
    const suspension = await prisma.suspension.findFirstOrThrow({ where: { playerId: player.id, isActive: true } });
    expect(suspension).toMatchObject({ reason: "YELLOW_ACCUMULATION", matchBan: 1, milestone: 3 });
    expect(await prisma.suspension.count({ where: { playerId: player.id } })).toBe(1);

    const next = await prisma.fixture.create({ data: { seasonId: season.id, homeTeamId: home.id, awayTeamId: away.id, matchDate: new Date("2026-03-05"), status: "SCHEDULED" } });
    await prisma.lineup.create({ data: { fixtureId: next.id, teamId: home.id, playerId: player.id } });
    await expect(assertPlayerEligibility(next, player.id, home.id)).rejects.toThrow("Suspended players");

    let response: any;
    await getFixtureLineupEligibility({ params: { id: next.id } } as any, { json: (value: any) => { response = value; } } as any, error => { throw error; });
    expect(response.suspensions).toEqual([expect.objectContaining({ playerId: player.id, reason: "YELLOW_ACCUMULATION" })]);

    let kickoffError: any;
    await updateFixtureStatus({ params: { id: next.id }, body: { status: "LIVE" } } as any, {} as any, error => { kickoffError = error; });
    expect(kickoffError?.message).toContain("Suspended players");
    expect((await prisma.fixture.findUniqueOrThrow({ where: { id: next.id } })).status).toBe("SCHEDULED");
  }, 30_000);
});
