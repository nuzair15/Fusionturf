import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const url = process.env.SEASON_TEST_DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Season integration tests require an isolated local database ending in _test");
    process.env.DATABASE_URL = url;
  }
});
import prisma from "../config/database.js";
import { previewSeasonTransition, createSeasonDraft, seasonReadiness, activateSeason } from "./season-transition.js";
import { registerPlayer, updateRosterPlayer } from "./player-roster.js";
import { rebuildHistoricalPlayerStats } from "./historical-player-stats.js";
import { publicSeasonScope } from "../utils/public-season-scope.js";
import { getPlayerBySlug } from "../controllers/league.js";
import { getSeasonOverview, seasonOverviewHtml } from "./season-overview.js";
import { syncFixtureBooking } from "./fixture-bookings.js";
import { archiveResource } from "./archive.js";
import { expandFollowIdentities } from "./follow-identities.js";
import { localDateTimeRange } from "../utils/time.js";
import { updateTeam } from "../controllers/admin/teams.js";

describe.skipIf(!process.env.SEASON_TEST_DATABASE_URL)("season transition on PostgreSQL", () => {
  let venue: any, source: any, teams: any[], scorer: any, inactive: any, draft: any, fixture: any, input: any;
  const suffix = crypto.randomUUID();
  beforeAll(async () => {
    await prisma.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    venue = await prisma.venue.create({ data: { name: "Test venue", slug: `venue-${suffix}`, address: "Test", city: "Test", state: "Test" } });
    await prisma.turf.create({ data: { venueId: venue.id, name: "Test turf" } });
    source = await prisma.season.create({ data: { name: "Source", slug: `source-${suffix}`, startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30"), isCurrent: true, isActive: true, lifecycle: "ACTIVE" } });
    teams = await Promise.all(["A", "B"].map(name => prisma.team.create({ data: { name, slug: `${name}-${suffix}`, seasonId: source.id, logoUrl: "/original-logo.png" } })));
    for (const team of teams) for (let i = 0; i < 8; i++) await registerPlayer({ firstName: `${team.name}${i}`, teamId: team.id, squadType: i < 6 ? "STARTER" : "SUBSTITUTE", jerseyNumber: i + 1 });
    scorer = await prisma.player.findFirstOrThrow({ where: { teamId: teams[0].id } });
    inactive = await registerPlayer({ firstName: "Inactive player", teamId: teams[0].id, squadType: "RESERVE", jerseyNumber: 99 });
    await updateRosterPlayer(inactive.id, { isActive: false, activityReason: "Unavailable" });
    await prisma.staff.create({ data: { teamId: teams[0].id, firstName: "Coach", lastName: "One", role: "Coach" } });
    await prisma.sponsor.create({ data: { teamId: teams[0].id, name: "Sponsor", logoUrl: "/sponsor.png" } });
    fixture = await prisma.fixture.create({ data: { seasonId: source.id, homeTeamId: teams[0].id, awayTeamId: teams[1].id, matchDate: new Date("2026-04-01"), status: "COMPLETED", homeScore: 1, awayScore: 0 } });
    await prisma.lineup.create({ data: { fixtureId: fixture.id, teamId: teams[0].id, playerId: scorer.id, isStarter: true } });
    await prisma.goal.create({ data: { fixtureId: fixture.id, teamId: teams[0].id, playerId: scorer.id, minute: 5 } });
    await prisma.suspension.create({ data: { seasonId: source.id, playerId: scorer.id, reason: "STRAIGHT_RED", matchBan: 2, served: 0 } });
  }, 30_000);
  afterAll(async () => { await prisma.$disconnect(); });

  it("preserves inactive players' historical goals and appearances during rebuild", async () => {
    await updateRosterPlayer(scorer.id, { isActive: false, activityReason: "Injury" });
    await rebuildHistoricalPlayerStats(source.id, false);
    const stat = await prisma.playerStat.findUniqueOrThrow({ where: { seasonId_playerId_teamId: { seasonId: source.id, playerId: scorer.id, teamId: teams[0].id } } });
    expect(stat.goals).toBe(1); expect(stat.appearances).toBe(1);
    await updateRosterPlayer(scorer.id, { isActive: true, activityReason: "Returned" });
    expect(await prisma.suspension.count({ where: { playerId: scorer.id, isActive: true } })).toBe(1);
  });
  it("rejects a stale roster preview", async () => {
    const preview = await previewSeasonTransition(source.id);
    input = { name: `Next ${suffix}`, startDate: "2026-07-01", endDate: "2026-12-31", requestKey: crypto.randomUUID(), fingerprint: preview.fingerprint, renewSponsors: true };
    await updateRosterPlayer(scorer.id, { biography: "Updated after preview" });
    await expect(createSeasonDraft(source.id, input)).rejects.toThrow("Refresh the preview");
    expect(await prisma.season.count({ where: { sourceSeasonId: source.id } })).toBe(0);
  });
  it("saves the hero banner on both the team and permanent club", async () => {
    let response: any;
    await updateTeam({ params: { id: teams[0].id }, body: { coverUrl: "/team-banner.webp" } } as any, { json: (value: any) => { response = value; } } as any, error => { throw error; });
    expect(response.coverUrl).toBe("/team-banner.webp");
    expect((await prisma.club.findUniqueOrThrow({ where: { id: response.clubId } })).coverUrl).toBe("/team-banner.webp");
  });
  it("creates a private draft with shared identities, zero standings, staff and chosen sponsors", async () => {
    input.fingerprint = (await previewSeasonTransition(source.id)).fingerprint;
    draft = await createSeasonDraft(source.id, input);
    expect(draft.lifecycle).toBe("DRAFT"); expect(draft.isCurrent).toBe(false);
    expect((await prisma.season.findUniqueOrThrow({ where: { id: source.id } })).isCurrent).toBe(true);
    const targetPlayers = await prisma.player.findMany({ where: { seasonId: draft.id } });
    expect(targetPlayers).toHaveLength(16);
    expect(targetPlayers.some(p => p.profileId === scorer.profileId)).toBe(true);
    expect(targetPlayers.some(p => p.profileId === inactive.profileId)).toBe(false);
    expect(await prisma.standing.count({ where: { seasonId: draft.id, points: 0 } })).toBe(2);
    expect(await prisma.staff.count({ where: { team: { seasonId: draft.id } } })).toBe(1);
    expect(await prisma.sponsor.count({ where: { team: { seasonId: draft.id } } })).toBe(1);
    expect(await prisma.suspension.count({ where: { seasonId: draft.id } })).toBe(0);
    expect(await prisma.playerStat.count({ where: { seasonId: draft.id } })).toBe(0);
    expect((draft.rolloverReport as any).excluded).toBe(1);
    expect((await prisma.team.findFirstOrThrow({ where: { seasonId: draft.id, name: teams[0].name } })).coverUrl).toBe("/team-banner.webp");
  });
  it("never exports draft seasons through the overview", async () => {
    await expect(getSeasonOverview(draft.slug)).rejects.toThrow("Published season not found");
  });
  it("returns the committed draft on retry and rejects another copy", async () => {
    const retries = await Promise.all([createSeasonDraft(source.id, input), createSeasonDraft(source.id, input)]);
    expect(retries.every(r => r.id === draft.id)).toBe(true);
    await expect(createSeasonDraft(source.id, { ...input, requestKey: crypto.randomUUID() })).rejects.toThrow("already exists");
    expect(await prisma.player.count({ where: { seasonId: draft.id } })).toBe(16);
  });
  it("filters direct draft lookups from public requests without hiding admin access", async () => {
    const result = await new Promise((resolve, reject) => publicSeasonScope({} as any, {} as any, () => {
      prisma.season.findUnique({ where: { id: draft.id } }).then(resolve, reject);
    }));
    expect(result).toBe(null);
    expect(await prisma.season.findUnique({ where: { id: draft.id } })).not.toBe(null);
  });
  it("requires fixtures before activation", async () => {
    expect((await seasonReadiness(draft.id)).blockers).toContain("Prepare the Season 2 fixtures first.");
    await expect(activateSeason(draft.id)).rejects.toThrow("fixtures");
  });
  it("rolls back a failed draft transaction without leaving partial teams or source identities", async () => {
    const source2 = await prisma.season.create({ data: { name: "Rollback source", slug: `rollback-${suffix}`, lifecycle: "ACTIVE", startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30") } });
    const team = await prisma.team.create({ data: { seasonId: source2.id, name: "Rollback club", slug: `rollback-team-${suffix}` } });
    const person = await prisma.player.create({ data: { seasonId: source2.id, teamId: team.id, firstName: "__FAIL_DRAFT__", lastName: "Test", slug: `fail-${suffix}` } });
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_reject_draft_player() RETURNS trigger AS $$ BEGIN IF NEW."firstName" = '__FAIL_DRAFT__' AND (SELECT "lifecycle" FROM "seasons" WHERE "id" = NEW."seasonId") = 'DRAFT' THEN RAISE EXCEPTION 'injected draft failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_reject_draft_player BEFORE INSERT ON "players" FOR EACH ROW EXECUTE FUNCTION test_reject_draft_player()`);
    try {
      const preview = await previewSeasonTransition(source2.id);
      await expect(createSeasonDraft(source2.id, { ...input, name: `Rollback target ${suffix}`, requestKey: crypto.randomUUID(), fingerprint: preview.fingerprint })).rejects.toThrow();
      expect(await prisma.season.count({ where: { sourceSeasonId: source2.id } })).toBe(0);
      expect((await prisma.player.findUniqueOrThrow({ where: { id: person.id } })).profileId).toBeNull();
      expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).clubId).toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER test_reject_draft_player ON "players"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION test_reject_draft_player()`);
    }
  });
  it("handles concurrent first submissions as one draft", async () => {
    const source2 = await prisma.season.create({ data: { name: "Concurrent source", slug: `concurrent-${suffix}`, lifecycle: "ACTIVE", startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30") } });
    const team = await prisma.team.create({ data: { seasonId: source2.id, name: "Concurrent club", slug: `concurrent-team-${suffix}` } });
    await registerPlayer({ firstName: "Concurrent player", teamId: team.id });
    const request = { ...input, name: `Concurrent target ${suffix}`, requestKey: crypto.randomUUID(), fingerprint: (await previewSeasonTransition(source2.id)).fingerprint };
    const results = await Promise.all([createSeasonDraft(source2.id, request), createSeasonDraft(source2.id, request)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.season.count({ where: { sourceSeasonId: source2.id } })).toBe(1);
  });
  it("prevents cross-season transfers and duplicate registration", async () => {
    const targetTeam = await prisma.team.findFirstOrThrow({ where: { seasonId: draft.id } });
    await expect(updateRosterPlayer(scorer.id, { teamId: targetTeam.id, transferReason: "Move" })).rejects.toThrow();
    await expect(registerPlayer({ profileId: scorer.profileId, teamId: targetTeam.id })).rejects.toThrow("already has");
    expect((await prisma.player.findUniqueOrThrow({ where: { id: scorer.id } })).seasonId).toBe(source.id);
  });
  it("requires confirmation before removing scheduled squads and retains completed lineups", async () => {
    const scheduled = await prisma.fixture.create({ data: { seasonId: source.id, homeTeamId: teams[0].id, awayTeamId: teams[1].id, matchDate: new Date("2026-06-01") } });
    await prisma.lineup.create({ data: { fixtureId: scheduled.id, teamId: teams[0].id, playerId: scorer.id } });
    await expect(updateRosterPlayer(scorer.id, { isActive: false, activityReason: "Unavailable" })).rejects.toThrow("Confirm removal");
    await updateRosterPlayer(scorer.id, { isActive: false, activityReason: "Unavailable", clearFutureSquads: true });
    expect(await prisma.lineup.count({ where: { fixtureId: scheduled.id, playerId: scorer.id } })).toBe(0);
    expect(await prisma.lineup.count({ where: { fixtureId: fixture.id, playerId: scorer.id } })).toBe(1);
    await prisma.fixture.update({ where: { id: scheduled.id }, data: { status: "CANCELLED" } });
  });
  it("activates atomically, resets bans and keeps historical profiles accessible", async () => {
    const targetTeams = await prisma.team.findMany({ where: { seasonId: draft.id } });
    await prisma.fixture.create({ data: { seasonId: draft.id, homeTeamId: targetTeams[0].id, awayTeamId: targetTeams[1].id, venueId: venue.id, scheduledDate: "2026-08-01", kickoffTime: "18:00", matchDate: new Date("2026-08-01") } });
    const planned = await prisma.fixture.findFirstOrThrow({ where: { seasonId: draft.id } });
    expect(await syncFixtureBooking(planned.id)).toBeNull();
    expect(await prisma.booking.count({ where: { idempotencyKey: `fixture-reservation:${planned.id}` } })).toBe(0);
    expect(await seasonReadiness(draft.id)).toMatchObject({ ready: true });
    const turf = await prisma.turf.findFirstOrThrow({ where: { venueId: venue.id } });
    const range = localDateTimeRange("2026-08-01", "18:00", "19:00", "Asia/Kolkata");
    const conflicting = await prisma.booking.create({ data: { turfId: turf.id, bookingNumber: `CONFLICT-${suffix}`, date: new Date("2026-08-01"), startTime: "18:00", endTime: "19:00", startAt: range.startAt, endAt: range.endAt, duration: 60, numPlayers: 12, totalAmount: 100, customerName: "Test booking", customerPhone: "000", status: "CONFIRMED", blocksAvailability: true } });
    await expect(activateSeason(draft.id)).rejects.toThrow("overlaps booking");
    expect((await prisma.season.findUniqueOrThrow({ where: { id: source.id } })).isCurrent).toBe(true);
    expect((await prisma.season.findUniqueOrThrow({ where: { id: draft.id } })).lifecycle).toBe("DRAFT");
    expect(await prisma.booking.count({ where: { idempotencyKey: `fixture-reservation:${planned.id}` } })).toBe(0);
    await prisma.booking.update({ where: { id: conflicting.id }, data: { status: "CANCELLED", blocksAvailability: false } });
    await activateSeason(draft.id);
    expect(await prisma.booking.count({ where: { idempotencyKey: `fixture-reservation:${planned.id}`, blocksAvailability: true } })).toBe(1);
    expect(await prisma.season.count({ where: { isCurrent: true } })).toBe(1);
    expect((await prisma.season.findUniqueOrThrow({ where: { id: source.id } })).lifecycle).toBe("COMPLETED");
    expect(await prisma.suspension.count({ where: { seasonId: source.id } })).toBe(1);
    expect(await prisma.suspension.count({ where: { seasonId: draft.id } })).toBe(0);
    await expect(updateRosterPlayer(scorer.id, { firstName: "Changed" })).rejects.toThrow("read-only");
    await expect(archiveResource({ type: "player", id: scorer.id })).rejects.toThrow("read-only");
    const followed = await expandFollowIdentities([{ teamId: teams[0].id, playerId: scorer.id }]);
    expect(followed.players.map(p => p.seasonId)).toContain(draft.id);
    expect(followed.teams.map(t => t.seasonId)).toContain(draft.id);
    let result: any;
    await getPlayerBySlug({ params: { slug: scorer.slug }, query: {} } as any, { json: (value: any) => { result = value; } } as any, error => { throw error; });
    expect(result.seasons).toHaveLength(2); expect(result.career.goals).toBe(1); expect(result.matchHistory).toHaveLength(1);
    expect(result.profileStats.find((s: any) => s.seasonId === draft.id && s.competition === "LEAGUE").goals).toBe(0);
  });
  it("exports detailed historical data and HTML without private metadata or JavaScript rendering", async () => {
    const data = await getSeasonOverview(source.slug);
    expect(data.summary.completed).toBe(1);
    expect(data.teams.some(t => t.players.some(p => p.id === inactive.id && !p.isActive))).toBe(true);
    const json = JSON.stringify(data);
    expect(json).not.toContain("activityReason"); expect(json).not.toContain("rolloverKey"); expect(json).not.toContain("manualOverrides");
    const html = seasonOverviewHtml(data);
    expect(html).toContain("Standings"); expect(html).toContain("Fixtures and results"); expect(html).toContain("Teams and squads");
    expect(html).toContain('application/ld+json'); expect(html).toContain(scorer.firstName);
  });
});
