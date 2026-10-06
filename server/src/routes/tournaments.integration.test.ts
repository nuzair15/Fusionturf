import { afterAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

vi.hoisted(() => {
  const url = process.env.TOURNAMENT_TEST_DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Tournament integration tests require an isolated local *_test database");
    process.env.DATABASE_URL = url;
  }
});
import app from "../index.js";
import prisma from "../config/database.js";
import { config } from "../config/index.js";

describe.skipIf(!process.env.TOURNAMENT_TEST_DATABASE_URL)("tournament HTTP workflow on PostgreSQL", () => {
  let server: Server | undefined;
  afterAll(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); await prisma.$disconnect(); });

  it("creates, publishes and plays a tournament without exposing its draft or touching league data", async () => {
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    const base = `http://127.0.0.1:${address.port}/api`;
    const user = await prisma.user.create({ data: { email: `tournament-${crypto.randomUUID()}@example.test`, passwordHash: "test-only", firstName: "Tournament", lastName: "Admin", role: "LEAGUE_ADMIN" } });
    const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret);
    const call = async (method: string, path: string, body?: unknown, authenticated = true) => {
      const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: response.status === 204 ? null : await response.json() as any };
    };
    let tournamentId = "";
    try {
      const before = { teams: await prisma.team.count(), fixtures: await prisma.fixture.count() };
      const slug = `route-cup-${crypto.randomUUID()}`;
      const created = await call("POST", "/admin/tournaments", {
        name: "Route Cup", slug, format: "SINGLE_ELIMINATION", startDate: "2026-10-10", endDate: "2026-10-11",
        lineupSize: 3, halfLengthMinutes: 20, halftimeBreakMinutes: 5, matchesPerPair: 1,
        kickoffTime: "18:00", matchIntervalMinutes: 60, matchesPerDay: 2,
      });
      expect(created.status).toBe(201);
      tournamentId = created.data.id;
      const hidden = await call("GET", `/tournaments/${slug}`, undefined, false);
      expect(hidden.status).toBe(404);
      const teamIds: string[] = [];
      const playerIds: string[][] = [];
      for (const name of ["Red", "Blue"]) {
        const team = await call("POST", `/admin/tournaments/${tournamentId}/teams`, { name });
        expect(team.status).toBe(201);
        teamIds.push(team.data.id);
        const ids: string[] = [];
        for (let number = 1; number <= 3; number++) {
          const player = await call("POST", `/admin/tournaments/${tournamentId}/teams/${team.data.id}/players`, { firstName: `P${number}`, lastName: name, jerseyNumber: number });
          expect(player.status).toBe(201);
          ids.push(player.data.id);
        }
        playerIds.push(ids);
      }
      const generated = await call("POST", `/admin/tournaments/${tournamentId}/fixtures/generate`, {});
      expect(generated.status).toBe(201);
      expect(generated.data.count).toBe(1);
      const detail = await call("GET", `/admin/tournaments/${tournamentId}`);
      const fixtureId = detail.data.fixtures[0].id;
      expect(detail.data.fixtures[0].homeTeam.players).toHaveLength(3);
      const published = await call("PATCH", `/admin/tournaments/${tournamentId}/status`, { status: "PUBLISHED" });
      expect(published.status).toBe(200);
      expect((await call("GET", `/tournaments/${slug}`, undefined, false)).status).toBe(200);
      const lineups = await call("PUT", `/admin/tournaments/${tournamentId}/fixtures/${fixtureId}/lineups`, { homeStarterIds: playerIds[0], awayStarterIds: playerIds[1] });
      expect(lineups.status).toBe(200);
      expect((await call("POST", `/admin/tournaments/${tournamentId}/fixtures/${fixtureId}/live-action`, { action: "setStatus", status: "LIVE" })).status).toBe(200);
      const goal = await call("POST", `/admin/tournaments/${tournamentId}/fixtures/${fixtureId}/live-action`, { action: "addGoal", teamId: teamIds[0], scorerId: playerIds[0][0], minute: 8 });
      expect(goal.status).toBe(200);
      expect((await call("POST", `/admin/tournaments/${tournamentId}/fixtures/${fixtureId}/live-action`, { action: "setStatus", status: "COMPLETED" })).status).toBe(200);
      const publicFixture = await call("GET", `/tournaments/${slug}/fixtures/${fixtureId}`, undefined, false);
      expect(publicFixture.status).toBe(200);
      expect(publicFixture.data.fixture.homeScore).toBe(1);
      expect(publicFixture.data.fixture.events.some((event: { kind: string }) => event.kind === "GOAL")).toBe(true);
      expect(await prisma.team.count()).toBe(before.teams);
      expect(await prisma.fixture.count()).toBe(before.fixtures);
    } finally {
      if (tournamentId) {
        await prisma.tournamentFixture.deleteMany({ where: { tournamentId } });
        await prisma.tournament.delete({ where: { id: tournamentId } });
      }
      await prisma.user.delete({ where: { id: user.id } });
    }
  }, 30_000);

  it("advances group winners and runs a double-elimination bracket reset", async () => {
    const admin = await prisma.user.create({ data: { email: `formats-${crypto.randomUUID()}@example.test`, passwordHash: "test-only", firstName: "Format", lastName: "Admin", role: "LEAGUE_ADMIN" } });
    const token = jwt.sign({ userId: admin.id, role: admin.role }, config.jwt.secret);
    const address = server?.address();
    const port = address && typeof address !== "string" ? address.port : 0;
    if (!port) throw new Error("Test server unavailable");
    const post = async (path: string) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/admin${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" });
      return { status: response.status, body: await response.json() as any };
    };
    const patchStatus = async (tournamentId: string) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/admin/tournaments/${tournamentId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "COMPLETED" }) });
      return response.status;
    };
    const ids: string[] = [];
    try {
      for (const format of ["GROUPS_KNOCKOUT", "DOUBLE_ELIMINATION"]) {
        const tournament = await prisma.tournament.create({ data: {
          name: format, slug: `format-${crypto.randomUUID()}`, format, status: "LIVE",
          startDate: new Date("2026-10-10"), kickoffTime: "18:00", groupCount: format === "GROUPS_KNOCKOUT" ? 2 : null,
          qualifiersPerGroup: format === "GROUPS_KNOCKOUT" ? 1 : null,
        } });
        ids.push(tournament.id);
        for (const [index, name] of ["A", "B", "C", "D"].entries()) await prisma.tournamentTeam.create({ data: { tournamentId: tournament.id, name, seed: index + 1 } });
        expect((await post(`/tournaments/${tournament.id}/fixtures/generate`)).status).toBe(201);
        const completeAll = async () => {
          const pending = await prisma.tournamentFixture.findMany({ where: { tournamentId: tournament.id, status: "SCHEDULED" }, orderBy: [{ round: "asc" }, { slot: "asc" }] });
          for (const fixture of pending) await prisma.tournamentFixture.update({ where: { id: fixture.id }, data: { status: "COMPLETED", homeScore: 1, awayScore: 0, winnerTeamId: fixture.homeTeamId } });
        };
        await completeAll();
        if (format === "GROUPS_KNOCKOUT") {
          const next = await post(`/tournaments/${tournament.id}/fixtures/next-round`);
          expect(next.status).toBe(201);
          expect(next.body.count).toBe(1);
          await completeAll();
          expect(await patchStatus(tournament.id)).toBe(200);
        } else {
          expect((await post(`/tournaments/${tournament.id}/fixtures/next-round`)).status).toBe(201);
          await completeAll();
          expect((await post(`/tournaments/${tournament.id}/fixtures/next-round`)).status).toBe(201);
          await completeAll();
          const firstFinal = await post(`/tournaments/${tournament.id}/fixtures/next-round`);
          expect(firstFinal.status).toBe(201);
          expect(firstFinal.body.count).toBe(1);
          const final = await prisma.tournamentFixture.findFirstOrThrow({ where: { tournamentId: tournament.id, stage: "FINAL", status: "SCHEDULED" } });
          await prisma.tournamentFixture.update({ where: { id: final.id }, data: { status: "COMPLETED", homeScore: 0, awayScore: 1, winnerTeamId: final.awayTeamId } });
          expect(await patchStatus(tournament.id)).toBe(409);
          const reset = await post(`/tournaments/${tournament.id}/fixtures/next-round`);
          expect(reset.status).toBe(201);
          expect(reset.body.count).toBe(1);
          await completeAll();
          expect(await patchStatus(tournament.id)).toBe(200);
        }
      }
    } finally {
      for (const tournamentId of ids) {
        await prisma.tournamentFixture.deleteMany({ where: { tournamentId } });
        await prisma.tournament.delete({ where: { id: tournamentId } });
      }
      await prisma.user.delete({ where: { id: admin.id } });
    }
  }, 30_000);
});
