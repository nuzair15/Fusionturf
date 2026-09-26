import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const url = process.env.SEASON_TEST_DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Final integration tests require an isolated local database ending in _test");
    process.env.DATABASE_URL = url;
  }
});
import prisma from "../config/database.js";
import { previewLeagueFinal, setLeagueFinal } from "./league-final.js";

describe.skipIf(!process.env.SEASON_TEST_DATABASE_URL)("league final on PostgreSQL", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("selects the top two by head-to-head goal difference and updates one scheduled final", async () => {
    const suffix = crypto.randomUUID();
    const season = await prisma.season.create({ data: { name: "Final test", slug: `final-${suffix}`, startDate: new Date("2026-01-01"), endDate: new Date("2026-04-30"), lifecycle: "ACTIVE", isActive: true } });
    const teams = await Promise.all(["A", "B", "C", "D"].map(name => prisma.team.create({ data: { name, slug: `${name}-${suffix}`, seasonId: season.id } })));
    const byName = Object.fromEntries(teams.map(team => [team.name, team]));
    const venue = await prisma.venue.create({ data: { name: "Final ground", slug: `final-ground-${suffix}`, address: "Test", city: "Test", state: "Test" } });
    await prisma.turf.create({ data: { venueId: venue.id, name: "Pitch" } });
    const match = async (home: string, away: string, homeScore: number, awayScore: number, day: number) => prisma.fixture.create({ data: { seasonId: season.id, homeTeamId: byName[home].id, awayTeamId: byName[away].id, matchDate: new Date(`2026-04-${String(day).padStart(2, "0")}`), status: "COMPLETED", homeScore, awayScore } });
    const ab = await match("A", "B", 1, 0, 1);
    await match("B", "C", 1, 0, 2);
    await match("D", "A", 10, 0, 3);
    await match("D", "B", 1, 0, 4);
    const pending = await prisma.fixture.create({ data: { seasonId: season.id, homeTeamId: byName.A.id, awayTeamId: byName.C.id, matchDate: new Date("2026-04-05") } });
    await prisma.standing.createMany({ data: teams.map(team => ({ seasonId: season.id, teamId: team.id })) });

    expect((await previewLeagueFinal(season.id)).ready).toBe(false);
    const input = { matchDate: "2026-05-07", kickoffTime: "18:00", venueId: venue.id };
    await expect(setLeagueFinal(season.id, input)).rejects.toMatchObject({ statusCode: 409 });
    await prisma.fixture.update({ where: { id: pending.id }, data: { status: "CANCELLED" } });
    const final = await setLeagueFinal(season.id, input);
    expect(final.homeTeamId).toBe(byName.D.id);
    expect(final.awayTeamId).toBe(byName.A.id);
    expect(final.isGrandFinal).toBe(true);
    expect(await prisma.fixture.count({ where: { seasonId: season.id, isRelegationPlayoff: true } })).toBe(0);
    expect((await setLeagueFinal(season.id, input)).id).toBe(final.id);
    expect(await prisma.fixture.count({ where: { seasonId: season.id, isGrandFinal: true, deletedAt: null } })).toBe(1);
    expect(await prisma.booking.count({ where: { idempotencyKey: `fixture-reservation:${final.id}`, blocksAvailability: true } })).toBe(1);

    await prisma.fixture.update({ where: { id: ab.id }, data: { homeScore: 0, awayScore: 1 } });
    const revised = await setLeagueFinal(season.id, input);
    expect(revised.id).toBe(final.id);
    expect(revised.awayTeamId).toBe(byName.B.id);
  }, 30_000);
});
