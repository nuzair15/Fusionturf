import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";

// Fixtures: scheduling, lineups, scores, and league/post-season generation


const FIXTURE_WRITABLE_FIELDS = [
  "seasonId", "competitionId", "homeTeamId", "awayTeamId", "venueId",
  "matchDate", "kickoffTime", "round", "leagueWeek",
  "isGrandFinal", "isRelegationPlayoff", "referee", "referee2",
  "isFriendly",
  "attendance", "stadium", "matchReport", "highlights", "isFeatured",
] as const;

async function validateFixtureReferences(data: Record<string, any>, excludeFixtureId?: string) {
  if (data.homeTeamId === data.awayTeamId) throw new AppError("A fixture must have two different teams", 400);
  const teams = await prisma.team.findMany({
    where: { id: { in: [data.homeTeamId, data.awayTeamId] } },
    select: { id: true, seasonId: true, isActive: true },
  });
  if (teams.length !== 2 || teams.some((team) => !team.isActive)) throw new AppError("Both fixture teams must be active and exist", 400);
  if (teams.some((team) => team.seasonId !== data.seasonId)) throw new AppError("Both teams must belong to the selected season", 400);
  if (data.competitionId) {
    const competition = await prisma.competition.findUnique({ where: { id: data.competitionId }, select: { seasonId: true } });
    if (!competition || competition.seasonId !== data.seasonId) throw new AppError("Competition must belong to the selected season", 400);
  }
  const matchDate = new Date(data.matchDate);
  if (Number.isNaN(matchDate.getTime())) throw new AppError("A valid match date is required", 400);
  const scheduledStatuses = { notIn: ["CANCELLED", "POSTPONED"] };
  const conflictWhere: any = {
    seasonId: data.seasonId,
    matchDate,
    status: scheduledStatuses,
    OR: [
      { homeTeamId: { in: [data.homeTeamId, data.awayTeamId] } },
      { awayTeamId: { in: [data.homeTeamId, data.awayTeamId] } },
    ],
  };
  if (excludeFixtureId) conflictWhere.id = { not: excludeFixtureId };
  if (data.kickoffTime) conflictWhere.kickoffTime = data.kickoffTime;
  const conflict = await prisma.fixture.findFirst({ where: conflictWhere, select: { id: true, homeTeamId: true, awayTeamId: true } });
  if (conflict) throw new AppError("A participating team is already scheduled in this time slot", 409);
}
// Deliberately excluded: status, homeScore, awayScore, and every live-match
// stat (homePossession, homeShots, ...). Those must be set through
// updateFixtureStatus / updateFixtureScore / the live-stats endpoints, which
// route through leagueSystem.processMatchResult so standings, suspensions,
// player stats, and awards get recalculated. Allowing them here let a caller
// mark a fixture COMPLETED with a score and silently skip that entire
// pipeline.

export const getFixtures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const { search } = req.query;
    const where: any = {};
    if (req.query.seasonId) where.seasonId = String(req.query.seasonId);
    if (req.query.friendly === "true") where.isFriendly = true;
    if (req.query.friendly === "false") where.isFriendly = false;
    if (search) where.OR = [
      { homeTeam: { name: { contains: search as string, mode: "insensitive" } } },
      { awayTeam: { name: { contains: search as string, mode: "insensitive" } } },
      { status: { contains: search as string, mode: "insensitive" } },
    ];
    const [data, total] = await Promise.all([
      prisma.fixture.findMany({
        where,
        include: { homeTeam: { select: { name: true, slug: true, logoUrl: true } }, awayTeam: { select: { name: true, slug: true, logoUrl: true } }, season: { select: { name: true } } },
        skip, take: limit,
        orderBy: { matchDate: "desc" },
      }),
      prisma.fixture.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pick(req.body, FIXTURE_WRITABLE_FIELDS);
    if (!data.seasonId || !data.homeTeamId || !data.awayTeamId || !data.matchDate) {
      throw new AppError("seasonId, homeTeamId, awayTeamId, and matchDate are required", 400);
    }
    await validateFixtureReferences(data as Record<string, any>);
    const fixture = await prisma.fixture.create({ data: { ...data, matchDate: new Date(data.matchDate) } as any });
    res.status(201).json(fixture);
  } catch (error) {
    next(error);
  }
};

export const updateFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, FIXTURE_WRITABLE_FIELDS);
    if (data.matchDate) data.matchDate = new Date(data.matchDate);
    const existing = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      select: { id: true, seasonId: true, status: true, isFriendly: true, homeTeamId: true, awayTeamId: true, competitionId: true, matchDate: true, kickoffTime: true, venueId: true },
    });
    if (!existing) throw new AppError("Fixture not found", 404);
    await validateFixtureReferences({ ...existing, ...data }, existing.id);
    const fixture = await prisma.fixture.update({
      where: { id: req.params.id },
      data,
    });
    // Toggling a completed match in/out of friendly must propagate to league
    // standings, player stats, and everything derived from them.
    if (existing.status === "COMPLETED" && ("isFriendly" in req.body || "competitionId" in req.body || "seasonId" in req.body || "homeTeamId" in req.body || "awayTeamId" in req.body)) {
      await leagueSystem.recalculateStandings(existing.seasonId);
      await leagueSystem.recalculatePlayerStats(existing.seasonId);
      if (fixture.seasonId !== existing.seasonId) {
        await leagueSystem.recalculateStandings(fixture.seasonId);
        await leagueSystem.recalculatePlayerStats(fixture.seasonId);
      }
    }
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

export const updateFixtureStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason } = req.body;
    const allowed = ["SCHEDULED", "LIVE", "PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES", "COMPLETED", "CANCELLED", "POSTPONED"];
    if (!allowed.includes(status)) throw new AppError("Invalid fixture status", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (status === "LIVE" && fixture.status === "COMPLETED") throw new AppError("Completed fixtures cannot return to live", 400);
    const now = new Date();
    if (status === "COMPLETED") {
      if (fixture.homeScore === null || fixture.awayScore === null) throw new AppError("Completed fixtures require scores", 400);
      await leagueSystem.processMatchResult(req.params.id, fixture.homeScore, fixture.awayScore);
    } else {
      const elapsed = fixture.status === "LIVE" && fixture.matchClockStartedAt
        ? fixture.matchClockSeconds + Math.max(0, Math.floor((now.getTime() - fixture.matchClockStartedAt.getTime()) / 1000))
        : fixture.matchClockSeconds;
      await prisma.fixture.update({ where: { id: req.params.id }, data: {
        status,
        ...(status === "POSTPONED" ? { postponementReason: reason ? String(reason).trim() : null } : {}),
        matchClockSeconds: elapsed,
        matchClockStartedAt: status === "LIVE" ? now : null,
      } });
    }
    res.json(await prisma.fixture.findUnique({ where: { id: req.params.id } }));
  } catch (error) {
    next(error);
  }
};

export const assignFixtureReferee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referee, referee2 } = req.body;
    if (!referee || !String(referee).trim()) throw new AppError("A referee name is required", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (fixture.status === "COMPLETED" || fixture.status === "CANCELLED") throw new AppError("Officials cannot be changed for this fixture", 400);
    const updated = await prisma.fixture.update({ where: { id: req.params.id }, data: { referee: String(referee).trim(), referee2: referee2 ? String(referee2).trim() : null, refereeAssignedAt: new Date() } });
    res.json(updated);
  } catch (error) { next(error); }
};

export const rescheduleFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchDate, kickoffTime, reason } = req.body;
    const existing = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("Fixture not found", 404);
    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") throw new AppError("Completed or cancelled fixtures cannot be rescheduled", 400);
    let nextDate = matchDate ? new Date(matchDate) : new Date(existing.matchDate);
    if (Number.isNaN(nextDate.getTime())) throw new AppError("A valid rescheduled date is required", 400);
    const nextKickoff = kickoffTime ?? existing.kickoffTime;
    if (!matchDate) {
      let found = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          await validateFixtureReferences({ ...existing, matchDate: nextDate, kickoffTime: nextKickoff }, existing.id);
          found = true;
          break;
        } catch (error: any) {
          if (error?.statusCode !== 409) throw error;
          nextDate = new Date(nextDate);
          nextDate.setDate(nextDate.getDate() + 1);
        }
      }
      if (!found) throw new AppError("No available rescheduling slot found in the next 30 days", 409);
    } else {
      await validateFixtureReferences({ ...existing, matchDate: nextDate, kickoffTime: nextKickoff }, existing.id);
    }
    const updated = await prisma.fixture.update({ where: { id: existing.id }, data: {
      matchDate: nextDate,
      kickoffTime: nextKickoff,
      originalMatchDate: existing.originalMatchDate || existing.matchDate,
      rescheduleReason: reason ? String(reason).trim() : null,
      rescheduledAt: new Date(),
      status: "SCHEDULED",
    } });
    res.json(updated);
  } catch (error) { next(error); }
};

export const settleFixtureOutcome = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { outcome, winnerTeamId, reason } = req.body;
    if (outcome !== "WALKOVER" && outcome !== "FORFEIT") throw new AppError("Outcome must be WALKOVER or FORFEIT", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (fixture.status === "COMPLETED" || fixture.status === "CANCELLED") throw new AppError("This fixture is already closed", 400);
    if (![fixture.homeTeamId, fixture.awayTeamId].includes(winnerTeamId)) throw new AppError("Winner must be one of the fixture teams", 400);
    const homeScore = winnerTeamId === fixture.homeTeamId ? 3 : 0;
    const awayScore = winnerTeamId === fixture.awayTeamId ? 3 : 0;
    await leagueSystem.processMatchResult(fixture.id, homeScore, awayScore, winnerTeamId);
    const updated = await prisma.fixture.update({ where: { id: fixture.id }, data: { outcome, winnerTeamId, matchReport: reason ? String(reason).trim() : fixture.matchReport } });
    res.json(updated);
  } catch (error) { next(error); }
};

export const getFixtureResultHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const history = await prisma.matchResultRevision.findMany({
      where: { fixtureId: fixture.id },
      include: { changedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
};

export const resetFixtureClock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.update({
      where: { id: req.params.id },
      data: { matchClockSeconds: 0, matchClockStartedAt: "LIVE" === (await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { status: true } }))?.status ? new Date() : null },
    });
    res.json({ matchClockSeconds: fixture.matchClockSeconds });
  } catch (error) { next(error); }
};

export const updateFixtureScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeScore, awayScore, reason, winnerTeamId, extraTimeHomeScore, extraTimeAwayScore, penaltiesHomeScore, penaltiesAwayScore } = req.body;
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      throw new AppError("Scores must be non-negative integers", 400);
    }
    const before = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { homeScore: true, awayScore: true } });
    if (!before) throw new AppError("Fixture not found", 404);
    const hasExtraTime = Number.isInteger(extraTimeHomeScore) || Number.isInteger(extraTimeAwayScore);
    const hasPenalties = Number.isInteger(penaltiesHomeScore) || Number.isInteger(penaltiesAwayScore);
    if ((hasExtraTime && (!Number.isInteger(extraTimeHomeScore) || !Number.isInteger(extraTimeAwayScore))) || (hasPenalties && (!Number.isInteger(penaltiesHomeScore) || !Number.isInteger(penaltiesAwayScore)))) {
      throw new AppError("Extra-time and penalty scores must be supplied as complete integer pairs", 400);
    }
    await leagueSystem.processMatchResult(req.params.id, homeScore, awayScore, winnerTeamId);
    if (hasExtraTime || hasPenalties) await prisma.fixture.update({ where: { id: req.params.id }, data: {
      extraTimeHomeScore: hasExtraTime ? extraTimeHomeScore : null,
      extraTimeAwayScore: hasExtraTime ? extraTimeAwayScore : null,
      penaltiesHomeScore: hasPenalties ? penaltiesHomeScore : null,
      penaltiesAwayScore: hasPenalties ? penaltiesAwayScore : null,
      outcome: hasPenalties ? "PENALTIES" : "EXTRA_TIME",
      winnerTeamId: winnerTeamId || null,
    } });
    if (before.homeScore !== homeScore || before.awayScore !== awayScore) {
      await prisma.matchResultRevision.create({ data: {
        fixtureId: req.params.id,
        changedById: req.user?.userId,
        previousHomeScore: before.homeScore,
        previousAwayScore: before.awayScore,
        nextHomeScore: homeScore,
        nextAwayScore: awayScore,
        reason: reason ? String(reason).trim() : null,
      } });
    }
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

export const deleteFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      select: { seasonId: true },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);

    await prisma.fixture.delete({ where: { id: req.params.id } });

    // Deleting removes the fixture (and its goals/cards/subs via cascade), so
    // recompute standings, player stats and awards for the season so the
    // deleted result stops counting in the league table.
    await leagueSystem.recalculateStandings(fixture.seasonId);
    try {
      await leagueSystem.recalculatePlayerStats(fixture.seasonId);
      await leagueSystem.autoDetectAwards(fixture.seasonId);
    } catch (error) {
      console.error("Failed to recalculate player stats/awards after fixture delete:", error);
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── Fixture Lineups ───

interface LineupEntryInput {
  playerId: string;
  isStarter?: boolean;
  isCaptain?: boolean;
  isGoalkeeper?: boolean;
  role?: string | null;
  xPosition?: number;
  yPosition?: number;
}

const clampCoord = (value: number | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, value));
};

/**
 * Replaces the full lineup for a fixture. Each team's list is validated
 * server-side: players must belong to that team, must not be duplicated, and
 * only one captain and one goalkeeper are allowed per team.
 */

export const updateFixtureLineups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      select: { id: true, homeTeamId: true, awayTeamId: true, status: true },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (fixture.status === "COMPLETED") throw new AppError("Use the audited correction flow for a completed fixture lineup", 400);

    const { home, away } = req.body || {};
    if (!Array.isArray(home) || !Array.isArray(away)) {
      throw new AppError("home and away lineup arrays are required", 400);
    }

    const buildEntries = async (teamId: string, raw: unknown[]): Promise<LineupEntryInput[]> => {
      const entries = raw.filter((e): e is Record<string, any> => !!e && typeof e === "object");
      if (entries.some((e) => typeof e.playerId !== "string" || !e.playerId)) {
        throw new AppError("Each lineup entry requires a valid playerId", 400);
      }

      const playerIds = entries.map((e) => e.playerId);
      if (new Set(playerIds).size !== playerIds.length) {
        throw new AppError("Duplicate players are not allowed in a lineup", 400);
      }

      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, teamId: true },
      });
      if (players.length !== playerIds.length) {
        throw new AppError("One or more players were not found", 400);
      }
      const wrongTeam = players.find((p) => p.teamId !== teamId);
      if (wrongTeam) {
        throw new AppError("A player does not belong to the selected team", 400);
      }

      const captains = entries.filter((e) => !!e.isCaptain).length;
      const keepers = entries.filter((e) => !!e.isGoalkeeper).length;
      if (captains > 1) throw new AppError("Only one captain is allowed per team", 400);
      if (keepers > 1) throw new AppError("Only one goalkeeper is allowed per team", 400);

      return entries.map((e) => {
        const role = typeof e.role === "string" && e.role.trim() ? e.role.trim() : null;
        return {
          playerId: e.playerId,
          isStarter: e.isStarter !== false,
          isCaptain: !!e.isCaptain,
          isGoalkeeper: !!e.isGoalkeeper,
          role: role || (e.isGoalkeeper ? "GK" : null),
          xPosition: clampCoord(e.xPosition),
          yPosition: clampCoord(e.yPosition),
        };
      });
    };

    const homeEntries = await buildEntries(fixture.homeTeamId, home);
    const awayEntries = await buildEntries(fixture.awayTeamId, away);

    await prisma.$transaction([
      prisma.lineup.deleteMany({ where: { fixtureId: fixture.id } }),
      prisma.lineup.createMany({
        data: [
          ...homeEntries.map((e) => ({
            fixtureId: fixture.id,
            teamId: fixture.homeTeamId,
            playerId: e.playerId,
            isStarter: e.isStarter ?? true,
            isCaptain: e.isCaptain ?? false,
            isGoalkeeper: e.isGoalkeeper ?? false,
            role: e.role ?? null,
            position: e.role ?? null,
            xPosition: e.xPosition ?? 50,
            yPosition: e.yPosition ?? 50,
          })),
          ...awayEntries.map((e) => ({
            fixtureId: fixture.id,
            teamId: fixture.awayTeamId,
            playerId: e.playerId,
            isStarter: e.isStarter ?? true,
            isCaptain: e.isCaptain ?? false,
            isGoalkeeper: e.isGoalkeeper ?? false,
            role: e.role ?? null,
            position: e.role ?? null,
            xPosition: e.xPosition ?? 50,
            yPosition: e.yPosition ?? 50,
          })),
        ],
      }),
    ]);

    // A saved lineup is an appearance under the agreed competition rule;
    // unused matchday-squad entries are intentionally not inserted here.
    await prisma.matchAppearance.deleteMany({ where: { fixtureId: fixture.id, isStarter: true } });
    await prisma.matchAppearance.createMany({
      data: [...homeEntries.map((entry) => ({ fixtureId: fixture.id, playerId: entry.playerId, teamId: fixture.homeTeamId, isStarter: entry.isStarter !== false })), ...awayEntries.map((entry) => ({ fixtureId: fixture.id, playerId: entry.playerId, teamId: fixture.awayTeamId, isStarter: entry.isStarter !== false }))],
      skipDuplicates: true,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const generateFixtures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leagueSystem.generateSeasonFixtures(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const generatePostSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await leagueSystem.generatePostSeasonFixtures(req.params.id);
    res.json({ message: "Post-season fixtures created" });
  } catch (error) {
    next(error);
  }
};

export const adminProcessMatchResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeScore, awayScore, reason, winnerTeamId } = req.body;
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) throw new AppError("Scores must be non-negative integers", 400);
    const before = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { homeScore: true, awayScore: true } });
    if (!before) throw new AppError("Fixture not found", 404);
    await leagueSystem.processMatchResult(req.params.id, homeScore, awayScore, winnerTeamId);
    if (before.homeScore !== homeScore || before.awayScore !== awayScore) {
      await prisma.matchResultRevision.create({ data: {
        fixtureId: req.params.id,
        changedById: req.user?.userId,
        previousHomeScore: before.homeScore,
        previousAwayScore: before.awayScore,
        nextHomeScore: homeScore,
        nextAwayScore: awayScore,
        reason: reason ? String(reason).trim() : null,
      } });
    }
    res.json({ message: "Match result processed" });
  } catch (error) {
    next(error);
  }
};
