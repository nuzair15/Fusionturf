import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/database.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { assignGroups, roundRobin, seededPairs, standings, TOURNAMENT_FORMATS, type PlannedPair } from "../services/tournament-format.js";
import { liveStats, liveAction } from "../services/tournament-live.js";
import { tournamentLocalDate, tournamentLocalToUtc } from "../utils/tournament-time.js";

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
const publicRouter = Router();
const adminRouter = Router();
adminRouter.use(authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"));

const id = z.string().uuid();
const name = z.string().trim().min(2).max(120);
const optionalText = (max = 1000) => z.string().trim().max(max).nullable().optional();
const optionalUrl = () => z.string().trim().url().max(2048).nullable().optional();
const date = z.coerce.date().nullable().optional();
const tournamentFields = z.object({
  name, slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  description: optionalText(3000), logoUrl: optionalUrl(),
  format: z.enum(TOURNAMENT_FORMATS), startDate: date, endDate: date,
  lineupSize: z.coerce.number().int().min(3).max(11),
  halfLengthMinutes: z.coerce.number().int().min(5).max(90),
  halftimeBreakMinutes: z.coerce.number().int().min(0).max(45),
  matchesPerPair: z.coerce.number().int().min(1).max(2),
  groupCount: z.coerce.number().int().min(2).max(16).nullable().optional(),
  qualifiersPerGroup: z.coerce.number().int().min(1).max(4).nullable().optional(),
  kickoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  matchIntervalMinutes: z.coerce.number().int().min(30).max(360),
  matchesPerDay: z.coerce.number().int().min(1).max(24),
}).refine(v => !v.startDate || !v.endDate || v.endDate >= v.startDate, "End date must follow start date");
const teamFields = z.object({
  name, shortName: optionalText(24), logoUrl: optionalUrl(), city: optionalText(100),
  coach: optionalText(120), contact: optionalText(120), description: optionalText(1000),
  groupName: z.string().trim().regex(/^[A-P]$/).nullable().optional(),
  seed: z.coerce.number().int().min(1).max(1000).nullable().optional(),
});
const playerFields = z.object({
  firstName: name, lastName: z.string().trim().max(120), jerseyNumber: z.coerce.number().int().min(0).max(99).nullable().optional(),
  position: optionalText(40), photoUrl: optionalUrl(), dateOfBirth: date, nationality: optionalText(80),
  isActive: z.boolean().optional(),
});
const fixtureFields = z.object({
  homeTeamId: id, awayTeamId: id, kickoffAt: z.coerce.date(),
  stage: z.enum(["LEAGUE", "GROUP", "KNOCKOUT", "WINNERS", "LOSERS", "FINAL"]).default("LEAGUE"),
  groupName: optionalText(8), round: z.coerce.number().int().min(1).max(100).default(1),
});
const fullTournament = {
  teams: { include: { players: { orderBy: [{ jerseyNumber: "asc" as const }, { firstName: "asc" as const }] } }, orderBy: [{ seed: "asc" as const }, { createdAt: "asc" as const }] },
  fixtures: { include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } }, lineups: true, events: { orderBy: { createdAt: "asc" as const } } }, orderBy: [{ kickoffAt: "asc" as const }, { createdAt: "asc" as const }] },
};
function assertDailyTiming(value: { kickoffTime?: string | null; matchIntervalMinutes: number; matchesPerDay: number }) {
  if (!value.kickoffTime) return;
  const [hours, minutes] = value.kickoffTime.split(":").map(Number);
  if (hours * 60 + minutes + (value.matchesPerDay - 1) * value.matchIntervalMinutes >= 1440) throw new AppError("The last daily kickoff must start before midnight", 400);
}
function assertFormatSettings(value: { format: string; matchesPerPair: number }) {
  if (!["ROUND_ROBIN", "GROUPS_KNOCKOUT"].includes(value.format) && value.matchesPerPair !== 1) throw new AppError("Multiple meetings per pair are available only for league and group formats", 400);
}
function assertFixtureStage(format: string, stage: string) {
  const allowed: Record<string, string[]> = {
    ROUND_ROBIN: ["LEAGUE"], SINGLE_ELIMINATION: ["KNOCKOUT", "FINAL"],
    DOUBLE_ELIMINATION: ["WINNERS", "LOSERS", "FINAL"], GROUPS_KNOCKOUT: ["GROUP", "KNOCKOUT", "FINAL"],
  };
  if (!allowed[format]?.includes(stage)) throw new AppError("Fixture stage does not match the tournament format", 400);
}

async function tournamentOrThrow(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new AppError("Tournament not found", 404);
  return tournament;
}
async function assertNotCompleted(tournamentId: string) {
  const tournament = await tournamentOrThrow(tournamentId);
  if (tournament.status === "COMPLETED") throw new AppError("Tournament is completed", 409);
  return tournament;
}
async function teamOrThrow(tournamentId: string, teamId: string) {
  const team = await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId } });
  if (!team) throw new AppError("Team does not belong to this tournament", 404);
  return team;
}
async function fixtureOrThrow(tournamentId: string, fixtureId: string) {
  const fixture = await prisma.tournamentFixture.findFirst({ where: { id: fixtureId, tournamentId }, include: { tournament: true } });
  if (!fixture) throw new AppError("Fixture not found in this tournament", 404);
  return fixture;
}
const publicStatus = { status: { in: ["PUBLISHED", "LIVE", "COMPLETED"] } };

publicRouter.get("/", wrap(async (_req, res) => {
  const rows = await prisma.tournament.findMany({
    where: publicStatus, include: { _count: { select: { teams: true, fixtures: true } } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
}));
publicRouter.get("/:slug", wrap(async (req, res) => {
  const row = await prisma.tournament.findFirst({ where: { slug: req.params.slug, ...publicStatus }, include: fullTournament });
  if (!row) throw new AppError("Tournament not found", 404);
  res.json({ ...row, standings: buildStandings(row) });
}));
publicRouter.get("/:slug/fixtures/:fixtureId", wrap(async (req, res) => {
  const row = await prisma.tournament.findFirst({ where: { slug: req.params.slug, ...publicStatus }, select: { id: true, name: true, slug: true, logoUrl: true, lineupSize: true, halfLengthMinutes: true, halftimeBreakMinutes: true } });
  if (!row) throw new AppError("Tournament not found", 404);
  const fixture = await prisma.tournamentFixture.findFirst({
    where: { id: req.params.fixtureId, tournamentId: row.id },
    include: { homeTeam: { include: { players: true } }, awayTeam: { include: { players: true } }, lineups: { include: { player: true } }, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!fixture) throw new AppError("Fixture not found", 404);
  const clockElapsed = ["LIVE", "EXTRA_TIME"].includes(fixture.status) && fixture.matchClockStartedAt
    ? Math.max(0, Math.floor((Date.now() - fixture.matchClockStartedAt.getTime()) / 1000)) : 0;
  res.json({ tournament: row, fixture: { ...fixture, matchClockSeconds: fixture.matchClockSeconds + clockElapsed } });
}));

function buildStandings(row: { teams: Array<{ id: string; groupName: string | null }>; fixtures: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number; status: string; stage: string; groupName: string | null }> }) {
  if (row.fixtures.some(f => f.stage === "GROUP")) {
    const groups = [...new Set(row.teams.map(t => t.groupName).filter((x): x is string => !!x))];
    return Object.fromEntries(groups.map(group => [group, standings(row.teams.filter(t => t.groupName === group).map(t => t.id), row.fixtures.filter(f => f.stage === "GROUP" && f.groupName === group))]));
  }
  const leagueFixtures = row.fixtures.filter(f => f.stage === "LEAGUE");
  return leagueFixtures.length ? { LEAGUE: standings(row.teams.map(t => t.id), leagueFixtures) } : {};
}

adminRouter.get("/", wrap(async (_req, res) => {
  res.json(await prisma.tournament.findMany({ include: { _count: { select: { teams: true, fixtures: true } } }, orderBy: { createdAt: "desc" } }));
}));
adminRouter.get("/:tournamentId", wrap(async (req, res) => {
  const row = await prisma.tournament.findUnique({ where: { id: req.params.tournamentId }, include: fullTournament });
  if (!row) throw new AppError("Tournament not found", 404);
  res.json({ ...row, standings: buildStandings(row) });
}));
adminRouter.post("/", wrap(async (req, res) => {
  const input = tournamentFields.parse(req.body);
  assertDailyTiming(input);
  assertFormatSettings(input);
  const row = await prisma.tournament.create({ data: { ...input, createdById: req.user!.userId } });
  res.status(201).json(row);
}));
adminRouter.patch("/:tournamentId", wrap(async (req, res) => {
  const current = await tournamentOrThrow(req.params.tournamentId);
  const input = tournamentFields.innerType().partial().parse(req.body);
  const next = { ...current, ...input };
  if (next.startDate && next.endDate && next.endDate < next.startDate) throw new AppError("End date must follow start date", 400);
  assertDailyTiming(next);
  assertFormatSettings(next);
  if (current.status === "COMPLETED") throw new AppError("Completed tournaments cannot be edited", 409);
  const hasFixtures = await prisma.tournamentFixture.count({ where: { tournamentId: current.id } });
  if (hasFixtures && ["format", "matchesPerPair", "groupCount", "qualifiersPerGroup"].some(key => key in input && (input as Record<string, unknown>)[key] !== (current as Record<string, unknown>)[key])) throw new AppError("Remove fixtures before changing the tournament format or group rules", 409);
  const started = await prisma.tournamentFixture.count({ where: { tournamentId: current.id, status: { not: "SCHEDULED" } } });
  if (started && ["lineupSize", "halfLengthMinutes", "halftimeBreakMinutes"].some(key => key in input && (input as Record<string, unknown>)[key] !== (current as Record<string, unknown>)[key])) throw new AppError("Match rules are locked after the first fixture starts", 409);
  res.json(await prisma.tournament.update({ where: { id: current.id }, data: input }));
}));
adminRouter.patch("/:tournamentId/status", wrap(async (req, res) => {
  const current = await tournamentOrThrow(req.params.tournamentId);
  const status = z.enum(["DRAFT", "PUBLISHED", "COMPLETED"]).parse(req.body.status);
  if (status === "PUBLISHED" && (await prisma.tournamentTeam.count({ where: { tournamentId: current.id } })) < 2) throw new AppError("Add at least two teams before publishing", 409);
  if (status === "PUBLISHED" && !(await prisma.tournamentFixture.count({ where: { tournamentId: current.id } }))) throw new AppError("Add or generate fixtures before publishing", 409);
  if (status === "COMPLETED") {
    const pending = await prisma.tournamentFixture.count({ where: { tournamentId: current.id, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
    if (pending) throw new AppError("Finish or cancel all fixtures before completing the tournament", 409);
    if (["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "GROUPS_KNOCKOUT"].includes(current.format)) {
      const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId: current.id }, select: { id: true, groupName: true } });
      const fixtures = await prisma.tournamentFixture.findMany({ where: { tournamentId: current.id, stage: { in: ["KNOCKOUT", "WINNERS", "LOSERS", "FINAL"] }, status: "COMPLETED" }, select: { homeTeamId: true, awayTeamId: true, winnerTeamId: true } });
      let contenderIds = teams.map(t => t.id);
      if (current.format === "GROUPS_KNOCKOUT") {
        const groupMatches = await prisma.tournamentFixture.findMany({ where: { tournamentId: current.id, stage: "GROUP" } });
        const groups = [...new Set(teams.map(t => t.groupName).filter((v): v is string => !!v))];
        contenderIds = groups.flatMap(group => standings(teams.filter(t => t.groupName === group).map(t => t.id), groupMatches.filter(f => f.groupName === group)).slice(0, current.qualifiersPerGroup || 2).map(row => row.teamId));
      }
      const losses = new Map(contenderIds.map(teamId => [teamId, 0]));
      for (const f of fixtures) {
        if (!f.winnerTeamId) throw new AppError("A knockout result needs a winner", 409);
        const loser = f.winnerTeamId === f.homeTeamId ? f.awayTeamId : f.homeTeamId;
        if (losses.has(loser)) losses.set(loser, (losses.get(loser) || 0) + 1);
      }
      const limit = current.format === "DOUBLE_ELIMINATION" ? 2 : 1;
      const contenders = [...losses.values()].filter(count => count < limit);
      if (contenders.length !== 1) throw new AppError("Generate and finish the remaining knockout rounds first", 409);
    }
  }
  if (current.status === "COMPLETED" && status !== "COMPLETED") throw new AppError("Completed tournaments cannot be reopened", 409);
  if (current.status === "LIVE" && status === "DRAFT") throw new AppError("A started tournament cannot return to draft", 409);
  res.json(await prisma.tournament.update({ where: { id: current.id }, data: { status } }));
}));
adminRouter.delete("/:tournamentId", wrap(async (req, res) => {
  const current = await tournamentOrThrow(req.params.tournamentId);
  if (current.status !== "DRAFT" || await prisma.tournamentFixture.count({ where: { tournamentId: current.id } })) throw new AppError("Only an empty draft tournament can be deleted", 409);
  await prisma.tournament.delete({ where: { id: current.id } });
  res.status(204).end();
}));

adminRouter.post("/:tournamentId/teams", wrap(async (req, res) => {
  const tournament = await tournamentOrThrow(req.params.tournamentId);
  if (tournament.status === "COMPLETED") throw new AppError("Tournament is completed", 409);
  const input = teamFields.parse(req.body);
  res.status(201).json(await prisma.tournamentTeam.create({ data: { ...input, tournamentId: tournament.id } }));
}));
adminRouter.patch("/:tournamentId/teams/:teamId", wrap(async (req, res) => {
  await assertNotCompleted(req.params.tournamentId);
  const team = await teamOrThrow(req.params.tournamentId, req.params.teamId);
  const input = teamFields.partial().parse(req.body);
  if (input.groupName !== undefined && input.groupName !== team.groupName && await prisma.tournamentFixture.count({ where: {
    tournamentId: team.tournamentId, stage: "GROUP", OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
  } })) throw new AppError("Remove this team's group fixtures before changing its group", 409);
  if (input.groupName !== undefined && input.groupName !== team.groupName && await prisma.tournamentFixture.count({ where: { tournamentId: team.tournamentId, status: { not: "SCHEDULED" } } })) throw new AppError("Group assignments are locked after matches start", 409);
  res.json(await prisma.tournamentTeam.update({ where: { id: team.id }, data: input }));
}));
adminRouter.delete("/:tournamentId/teams/:teamId", wrap(async (req, res) => {
  await assertNotCompleted(req.params.tournamentId);
  const team = await teamOrThrow(req.params.tournamentId, req.params.teamId);
  const matches = await prisma.tournamentFixture.count({ where: { tournamentId: team.tournamentId, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } });
  if (matches) throw new AppError("Remove this team's fixtures before deleting it", 409);
  await prisma.tournamentTeam.delete({ where: { id: team.id } });
  res.status(204).end();
}));
adminRouter.post("/:tournamentId/teams/:teamId/players", wrap(async (req, res) => {
  await assertNotCompleted(req.params.tournamentId);
  const team = await teamOrThrow(req.params.tournamentId, req.params.teamId);
  const input = playerFields.parse(req.body);
  res.status(201).json(await prisma.tournamentPlayer.create({ data: { ...input, teamId: team.id, tournamentId: team.tournamentId } }));
}));
adminRouter.patch("/:tournamentId/teams/:teamId/players/:playerId", wrap(async (req, res) => {
  await assertNotCompleted(req.params.tournamentId);
  await teamOrThrow(req.params.tournamentId, req.params.teamId);
  const input = playerFields.partial().parse(req.body);
  const player = await prisma.tournamentPlayer.findFirst({ where: { id: req.params.playerId, teamId: req.params.teamId, tournamentId: req.params.tournamentId } });
  if (!player) throw new AppError("Player not found", 404);
  res.json(await prisma.tournamentPlayer.update({ where: { id: player.id }, data: input }));
}));
adminRouter.delete("/:tournamentId/teams/:teamId/players/:playerId", wrap(async (req, res) => {
  await assertNotCompleted(req.params.tournamentId);
  const player = await prisma.tournamentPlayer.findFirst({ where: { id: req.params.playerId, teamId: req.params.teamId, tournamentId: req.params.tournamentId } });
  if (!player) throw new AppError("Player not found", 404);
  if (await prisma.tournamentEvent.count({ where: { OR: [{ playerId: player.id }, { relatedPlayerId: player.id }] } })) throw new AppError("Players with match events cannot be deleted; set them inactive instead", 409);
  await prisma.tournamentLineup.deleteMany({ where: { playerId: player.id } });
  await prisma.tournamentPlayer.delete({ where: { id: player.id } });
  res.status(204).end();
}));

function fixtureKickoff(startDate: Date, time: string, index: number, matchesPerDay: number, interval: number, timeZone: string) {
  const day = Math.floor(index / matchesPerDay);
  const slot = index % matchesPerDay;
  const [hours, minutes] = time.split(":").map(Number);
  const localDay = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + day)).toISOString().slice(0, 10);
  const totalMinutes = hours * 60 + minutes + slot * interval;
  const localTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  return tournamentLocalToUtc(localDay, localTime, timeZone);
}
function fixtureCreateData(tournamentId: string, pair: PlannedPair, kickoffAt: Date, slot: number) {
  return { tournamentId, ...pair, kickoffAt, slot };
}
adminRouter.post("/:tournamentId/fixtures/generate", wrap(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.tournamentId }, include: { teams: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] }, fixtures: true } });
  if (!tournament) throw new AppError("Tournament not found", 404);
  if (tournament.status === "COMPLETED") throw new AppError("Tournament is completed", 409);
  if (tournament.fixtures.length) throw new AppError("Fixtures already exist. Edit them or generate the next round after results.", 409);
  if (!tournament.startDate || !tournament.kickoffTime) throw new AppError("Set the start date and kickoff time first", 400);
  if (tournament.teams.length < 2) throw new AppError("Add at least two teams", 400);
  let planned: PlannedPair[] = [];
  let groups: Map<string, string> | null = null;
  if (tournament.format === "ROUND_ROBIN") {
    planned = roundRobin(tournament.teams.map(t => t.id), tournament.matchesPerPair);
  } else if (tournament.format === "GROUPS_KNOCKOUT") {
    const count = tournament.groupCount || 2;
    if (tournament.teams.length < count * 2) throw new AppError("Each group needs at least two teams", 400);
    const assignedCount = tournament.teams.filter(t => t.groupName).length;
    if (assignedCount > 0 && assignedCount !== tournament.teams.length) throw new AppError("Assign every team to a group, or clear all group assignments before generating fixtures", 400);
    const assigned = assignedCount === tournament.teams.length
      ? new Map(tournament.teams.map(t => [t.id, t.groupName!]))
      : assignGroups(tournament.teams, count);
    if (new Set(assigned.values()).size !== count) throw new AppError("Assigned group count does not match tournament settings", 400);
    groups = assigned;
    if ([...new Set(assigned.values())].some(group => tournament.teams.filter(t => assigned.get(t.id) === group).length < (tournament.qualifiersPerGroup || 2))) throw new AppError("Each group needs at least as many teams as qualifying places", 400);
    for (const group of [...new Set(assigned.values())]) {
      planned.push(...roundRobin(tournament.teams.filter(t => assigned.get(t.id) === group).map(t => t.id), tournament.matchesPerPair, "GROUP", group));
    }
  } else {
    planned = seededPairs(tournament.teams.map(t => t.id), 1, tournament.format === "DOUBLE_ELIMINATION" ? "WINNERS" : "KNOCKOUT");
  }
  const slots = new Map<string, number>();
  const data = planned.map((pair, index) => {
    const key = `${pair.stage}:${pair.round}`;
    const slot = (slots.get(key) || 0) + 1;
    slots.set(key, slot);
    return fixtureCreateData(tournament.id, pair, fixtureKickoff(tournament.startDate!, tournament.kickoffTime!, index, tournament.matchesPerDay, tournament.matchIntervalMinutes, tournament.timezone), slot);
  });
  if (tournament.endDate && data.some(f => f.kickoffAt.getTime() > tournament.endDate!.getTime() + 86400000)) throw new AppError("Generated fixtures extend beyond the tournament end date", 400);
  await prisma.$transaction(async tx => {
    if (groups) for (const team of tournament.teams) await tx.tournamentTeam.update({ where: { id: team.id }, data: { groupName: groups.get(team.id) } });
    await tx.tournamentFixture.createMany({ data });
  });
  res.status(201).json({ count: data.length });
}));

adminRouter.post("/:tournamentId/fixtures/next-round", wrap(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.tournamentId }, include: { teams: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] }, fixtures: { orderBy: [{ round: "asc" }, { slot: "asc" }] } } });
  if (!tournament) throw new AppError("Tournament not found", 404);
  if (!["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "GROUPS_KNOCKOUT"].includes(tournament.format)) throw new AppError("This format has no knockout rounds", 400);
  if (!tournament.fixtures.length || tournament.fixtures.some(f => !["COMPLETED", "CANCELLED"].includes(f.status))) throw new AppError("Finish all current fixtures before advancing", 409);
  const knockout = tournament.fixtures.filter(f => ["KNOCKOUT", "WINNERS", "LOSERS", "FINAL"].includes(f.stage));
  const nextRound = knockout.length ? Math.max(...knockout.map(f => f.round)) + 1 : 1;
  const losses = new Map(tournament.teams.map(t => [t.id, 0]));
  for (const match of knockout) {
    if (match.status === "CANCELLED") continue;
    if (!match.winnerTeamId) throw new AppError("Every knockout match needs a winner", 409);
    const loser = match.winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    losses.set(loser, (losses.get(loser) || 0) + 1);
  }
  let contenders = tournament.teams.map(t => t.id);
  if (tournament.format === "GROUPS_KNOCKOUT") {
    const groups = [...new Set(tournament.teams.map(t => t.groupName).filter((v): v is string => !!v))];
    contenders = groups.flatMap(group => standings(tournament.teams.filter(t => t.groupName === group).map(t => t.id), tournament.fixtures.filter(f => f.stage === "GROUP" && f.groupName === group)).slice(0, tournament.qualifiersPerGroup || 2).map(t => t.teamId));
  }
  contenders = contenders.filter(teamId => (losses.get(teamId) || 0) < (tournament.format === "DOUBLE_ELIMINATION" ? 2 : 1));
  if (contenders.length < 2) throw new AppError("Tournament has a winner; no further round is needed", 409);
  let planned: PlannedPair[];
  if (tournament.format === "DOUBLE_ELIMINATION") {
    const unbeaten = contenders.filter(t => losses.get(t) === 0);
    const oneLoss = contenders.filter(t => losses.get(t) === 1);
    planned = unbeaten.length === 1 && oneLoss.length === 1
      ? [{ homeTeamId: unbeaten[0], awayTeamId: oneLoss[0], round: nextRound, stage: "FINAL" }]
      : unbeaten.length === 0 && oneLoss.length === 2
      ? [{ homeTeamId: oneLoss[0], awayTeamId: oneLoss[1], round: nextRound, stage: "FINAL" }]
      : [...seededPairs(unbeaten, nextRound, "WINNERS"), ...seededPairs(oneLoss, nextRound, "LOSERS")];
  } else {
    planned = seededPairs(contenders, nextRound, "KNOCKOUT");
  }
  if (!planned.length) throw new AppError("No pairings can be made yet", 409);
  const lastKickoff = tournament.fixtures.reduce((latest, f) => f.kickoffAt > latest ? f.kickoffAt : latest, new Date(0));
  const dayAfterLast = new Date(tournamentLocalDate(lastKickoff, tournament.timezone) + "T00:00:00Z");
  dayAfterLast.setUTCDate(dayAfterLast.getUTCDate() + 1);
  const today = tournamentLocalDate(new Date(), tournament.timezone);
  let firstDay = dayAfterLast.toISOString().slice(0, 10) > today ? dayAfterLast.toISOString().slice(0, 10) : today;
  if (tournamentLocalToUtc(firstDay, tournament.kickoffTime || "18:00", tournament.timezone).getTime() <= Date.now()) {
    const next = new Date(firstDay + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    firstDay = next.toISOString().slice(0, 10);
  }
  const slots = new Map<string, number>();
  const data = planned.map((pair, index) => {
    const key = `${pair.stage}:${pair.round}`;
    const slot = (slots.get(key) || 0) + 1;
    slots.set(key, slot);
    return fixtureCreateData(tournament.id, pair, fixtureKickoff(new Date(firstDay + "T00:00:00Z"), tournament.kickoffTime || "18:00", index, tournament.matchesPerDay, tournament.matchIntervalMinutes, tournament.timezone), slot);
  });
  const endDate = tournament.endDate;
  if (endDate && data.some(f => f.kickoffAt.getTime() > endDate.getTime() + 86400000)) throw new AppError("The next round extends beyond the tournament end date. Update the end date first.", 400);
  await prisma.tournamentFixture.createMany({ data });
  res.status(201).json({ count: data.length, round: nextRound });
}));

adminRouter.post("/:tournamentId/fixtures", wrap(async (req, res) => {
  const tournament = await tournamentOrThrow(req.params.tournamentId);
  if (tournament.status === "COMPLETED") throw new AppError("Tournament is completed", 409);
  const input = fixtureFields.parse(req.body);
  assertFixtureStage(tournament.format, input.stage);
  if (input.homeTeamId === input.awayTeamId) throw new AppError("Choose two different teams", 400);
  const [home, away] = await Promise.all([teamOrThrow(tournament.id, input.homeTeamId), teamOrThrow(tournament.id, input.awayTeamId)]);
  if (input.stage === "GROUP" && (!input.groupName || home.groupName !== input.groupName || away.groupName !== input.groupName)) throw new AppError("Group fixtures need two teams assigned to the selected group", 400);
  const slot = (await prisma.tournamentFixture.aggregate({ where: { tournamentId: tournament.id, stage: input.stage, round: input.round }, _max: { slot: true } }))._max.slot || 0;
  res.status(201).json(await prisma.tournamentFixture.create({ data: { ...input, tournamentId: tournament.id, slot: slot + 1 } }));
}));
adminRouter.patch("/:tournamentId/fixtures/:fixtureId", wrap(async (req, res) => {
  const fixture = await fixtureOrThrow(req.params.tournamentId, req.params.fixtureId);
  if (fixture.status !== "SCHEDULED") throw new AppError("Only scheduled fixtures can be edited", 409);
  const input = fixtureFields.partial().parse(req.body);
  const homeTeamId = input.homeTeamId || fixture.homeTeamId, awayTeamId = input.awayTeamId || fixture.awayTeamId;
  if (homeTeamId === awayTeamId) throw new AppError("Choose two different teams", 400);
  const [home, away] = await Promise.all([teamOrThrow(fixture.tournamentId, homeTeamId), teamOrThrow(fixture.tournamentId, awayTeamId)]);
  assertFixtureStage(fixture.tournament.format, input.stage || fixture.stage);
  if ((input.stage || fixture.stage) === "GROUP" && (!(input.groupName ?? fixture.groupName) || home.groupName !== (input.groupName ?? fixture.groupName) || away.groupName !== (input.groupName ?? fixture.groupName))) throw new AppError("Group fixtures need two teams assigned to the selected group", 400);
  const teamsChanged = homeTeamId !== fixture.homeTeamId || awayTeamId !== fixture.awayTeamId;
  const stage = input.stage || fixture.stage, round = input.round || fixture.round;
  const changedSlot = stage !== fixture.stage || round !== fixture.round;
  const slot = changedSlot ? ((await prisma.tournamentFixture.aggregate({ where: { tournamentId: fixture.tournamentId, stage, round }, _max: { slot: true } }))._max.slot || 0) + 1 : fixture.slot;
  const updated = await prisma.$transaction(async tx => {
    if (teamsChanged) await tx.tournamentLineup.deleteMany({ where: { fixtureId: fixture.id } });
    return tx.tournamentFixture.update({ where: { id: fixture.id }, data: { ...input, slot } });
  });
  res.json(updated);
}));
adminRouter.delete("/:tournamentId/fixtures/:fixtureId", wrap(async (req, res) => {
  const fixture = await fixtureOrThrow(req.params.tournamentId, req.params.fixtureId);
  if (fixture.status !== "SCHEDULED") throw new AppError("Only scheduled fixtures can be deleted", 409);
  await prisma.tournamentFixture.delete({ where: { id: fixture.id } });
  res.status(204).end();
}));

adminRouter.put("/:tournamentId/fixtures/:fixtureId/lineups", wrap(async (req, res) => {
  const fixture = await fixtureOrThrow(req.params.tournamentId, req.params.fixtureId);
  if (fixture.status !== "SCHEDULED") throw new AppError("Lineups are locked once a match starts", 409);
  const body = z.object({
    homeStarterIds: z.array(id), awayStarterIds: z.array(id),
    homeSubstituteIds: z.array(id).default([]), awaySubstituteIds: z.array(id).default([]),
  }).parse(req.body);
  if (body.homeStarterIds.length !== fixture.tournament.lineupSize || body.awayStarterIds.length !== fixture.tournament.lineupSize) throw new AppError(`Choose exactly ${fixture.tournament.lineupSize} starters for each team`, 400);
  const allIds = [...body.homeStarterIds, ...body.awayStarterIds, ...body.homeSubstituteIds, ...body.awaySubstituteIds];
  if (new Set(allIds).size !== allIds.length) throw new AppError("A player can be listed only once", 400);
  const players = await prisma.tournamentPlayer.findMany({ where: { id: { in: allIds }, tournamentId: fixture.tournamentId, isActive: true } });
  if (players.length !== allIds.length) throw new AppError("All lineup players must be active tournament players", 400);
  const byId = new Map(players.map(p => [p.id, p]));
  for (const playerId of [...body.homeStarterIds, ...body.homeSubstituteIds]) if (byId.get(playerId)?.teamId !== fixture.homeTeamId) throw new AppError("Home lineup contains a player from another team", 400);
  for (const playerId of [...body.awayStarterIds, ...body.awaySubstituteIds]) if (byId.get(playerId)?.teamId !== fixture.awayTeamId) throw new AppError("Away lineup contains a player from another team", 400);
  const data = [
    ...body.homeStarterIds.map(playerId => ({ fixtureId: fixture.id, teamId: fixture.homeTeamId, playerId, isStarter: true })),
    ...body.awayStarterIds.map(playerId => ({ fixtureId: fixture.id, teamId: fixture.awayTeamId, playerId, isStarter: true })),
    ...body.homeSubstituteIds.map(playerId => ({ fixtureId: fixture.id, teamId: fixture.homeTeamId, playerId, isStarter: false })),
    ...body.awaySubstituteIds.map(playerId => ({ fixtureId: fixture.id, teamId: fixture.awayTeamId, playerId, isStarter: false })),
  ];
  await prisma.$transaction(async tx => {
    await tx.tournamentLineup.deleteMany({ where: { fixtureId: fixture.id } });
    await tx.tournamentLineup.createMany({ data });
  });
  res.json({ count: data.length });
}));
adminRouter.get("/:tournamentId/fixtures/:fixtureId/live-stats", wrap(async (req, res) => {
  const fixture = await fixtureOrThrow(req.params.tournamentId, req.params.fixtureId);
  res.json(await liveStats(fixture.id));
}));
adminRouter.post("/:tournamentId/fixtures/:fixtureId/live-action", wrap(async (req, res) => {
  const fixture = await fixtureOrThrow(req.params.tournamentId, req.params.fixtureId);
  res.json(await liveAction(fixture.id, req.body, req.user!.userId));
}));

export { publicRouter as tournamentPublicRoutes, adminRouter as tournamentAdminRoutes };
