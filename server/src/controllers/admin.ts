import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { config } from "../config/index.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../utils/helpers.js";
import { pick } from "../utils/pick.js";
import * as leagueSystem from "../services/league-system.js";

export const loginAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.adminPanel.password) throw new AppError("Admin authentication is not configured", 503);
    const { password } = req.body || {};
    if (typeof password !== "string" || password.length === 0 || password !== config.adminPanel.password) {
      throw new AppError("Invalid admin credentials", 401);
    }

    // Resolve to a real, deactivatable User row (created once, on first use)
    // instead of minting a token for a fake user id that bypassed the
    // database lookup in the auth middleware. This means: deactivating this
    // user immediately revokes admin-panel access, and every action taken
    // through this login is attributable to a real userId in ActivityLog.
    let bootstrapAdmin = await prisma.user.findUnique({ where: { email: config.adminPanel.bootstrapEmail } });
    if (!bootstrapAdmin) {
      const randomPassword = uuidv4() + uuidv4();
      bootstrapAdmin = await prisma.user.create({
        data: {
          email: config.adminPanel.bootstrapEmail,
          passwordHash: await bcrypt.hash(randomPassword, 12),
          firstName: "Super",
          lastName: "Admin",
          role: "SUPER_ADMIN",
          isActive: true,
          emailVerified: true,
        },
      });
    } else if (!bootstrapAdmin.isActive) {
      throw new AppError("Admin account has been deactivated", 403);
    }

    const token = jwt.sign({ userId: bootstrapAdmin.id, role: bootstrapAdmin.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
    res.json({ token });
  } catch (error) {
    next(error);
  }
};

// ─── Seasons Management ───

export const getSeasons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { teams: true, players: true, fixtures: true } } },
    });
    res.json(seasons);
  } catch (error) {
    next(error);
  }
};

export const createSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, startDate, endDate, isActive, isCurrent } = req.body;
    if (!name || !slug || !startDate || !endDate) {
      throw new AppError("name, slug, startDate, endDate are required", 400);
    }
    try {
      const season = await prisma.season.create({
        data: { name, slug, startDate: new Date(startDate), endDate: new Date(endDate), isActive: !!isActive, isCurrent: !!isCurrent },
      });
      res.status(201).json(season);
    } catch (err: any) {
      if (err.code === "P2002") throw new AppError("A season with that slug already exists", 409);
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

export const updateSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pick(req.body, ["name", "slug", "startDate", "endDate", "isActive", "isCurrent"] as const) as any;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    try {
      const season = await prisma.season.update({ where: { id: req.params.id }, data });
      res.json(season);
    } catch (err: any) {
      if (err.code === "P2002") throw new AppError("A season with that slug already exists", 409);
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

export const deleteSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await prisma.season.update({ where: { id: req.params.id }, data: { isActive: false, isCurrent: false } });
    res.json(season);
  } catch (error) {
    next(error);
  }
};

// ─── Teams Management ───

export const getTeams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, search } = req.query;
    const where: any = {};
    if (seasonId) where.seasonId = seasonId;
    if (search) where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { shortName: { contains: search as string, mode: "insensitive" } },
      { city: { contains: search as string, mode: "insensitive" } },
    ];
    const teams = await prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { players: true, homeMatches: true } } },
    });
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, shortName, logoUrl, city, seasonId, status } = req.body;
    if (!name || !seasonId) throw new AppError("name and seasonId are required", 400);
    const baseSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    let teamSlug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.team.findFirst({ where: { seasonId, slug: teamSlug } });
      if (!existing) break;
      teamSlug = `${baseSlug}-${attempt + 2}`;
    }
    const team = await prisma.team.create({
      data: {
        name, slug: teamSlug, shortName: shortName || null, logoUrl: logoUrl || null,
        city: city || null, seasonId, status: status || "active", isActive: status !== "inactive",
      },
    });
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const data = pick(req.body, ["name", "slug", "shortName", "logoUrl", "city", "seasonId", "status"] as const) as any;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
    if (status !== undefined) data.isActive = status !== "inactive";
    try {
      const team = await prisma.team.update({ where: { id: req.params.id }, data });
      res.json(team);
    } catch (err: any) {
      if (err.code === "P2002") throw new AppError("A team with that slug already exists in this season", 409);
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const team = await prisma.team.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json(team);
  } catch (error) {
    next(error);
  }
};

// ─── Players Management ───

export const getPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const { teamId, seasonId, search } = req.query;
    const where: any = {};
    if (teamId) where.teamId = teamId;
    if (seasonId) where.seasonId = seasonId;
    if (search) {
      const { ids, total } = await searchPlayerIds(search as string, {
        teamId: teamId as string, seasonId: seasonId as string,
        limit, offset: skip,
      });
      if (ids.length === 0) return res.json(paginatedResponse([], total, page, limit));
      where.id = { in: ids };
      const data = await prisma.player.findMany({
        where,
        include: { team: { select: { name: true, slug: true } } },
        orderBy: { firstName: "asc" },
      });
      return res.json(paginatedResponse(data, total, page, limit));
    }
    const [data, total] = await Promise.all([
      prisma.player.findMany({
        where,
        include: { team: { select: { name: true, slug: true } } },
        skip, take: limit,
        orderBy: { firstName: "asc" },
      }),
      prisma.player.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createPlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, position, teamId, jerseyNumber, squadType, photoUrl, nationality, age, height, weight, preferredFoot, biography } = req.body;
    if (!firstName || !teamId) return res.status(400).json({ error: "firstName and teamId are required" });
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { seasonId: true } });
    if (!team) return res.status(400).json({ error: "Team not found or has no season" });
    const slug = `${firstName.toLowerCase()}-${(lastName || "player").toLowerCase()}-${Date.now()}`.replace(/[^a-z0-9-]+/g, "-");
    const player = await prisma.player.create({
      data: {
        firstName, lastName: lastName || "", slug,
        position: position || null, jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
        squadType: squadType || null, teamId, seasonId: team.seasonId,
        photoUrl: photoUrl || null, nationality: nationality || null,
        age: age ? parseInt(age) : null, height: height ? parseInt(height) : null,
        weight: weight ? parseInt(weight) : null, preferredFoot: preferredFoot || null,
        biography: biography || null, isActive: true,
      } as any,
    });
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
};

export const updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, position, teamId, jerseyNumber, squadType, photoUrl, nationality, age, height, weight, preferredFoot, biography } = req.body;
    const current = await prisma.player.findUnique({ where: { id: req.params.id }, select: { teamId: true, seasonId: true } });
    if (!current) throw new AppError("Player not found", 404);
    if (teamId !== undefined && teamId !== current.teamId) {
      const season = await prisma.season.findUnique({ where: { id: current.seasonId }, select: { transferWindowOpen: true } });
      if (season && !season.transferWindowOpen) {
        throw new AppError("Transfer window is closed. Cannot change player team.", 400);
      }
    }
    const data: any = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (position !== undefined) data.position = position;
    if (jerseyNumber !== undefined && jerseyNumber !== "") data.jerseyNumber = parseInt(jerseyNumber);
    if (squadType !== undefined && squadType !== "") data.squadType = squadType;
    if (teamId !== undefined) {
      data.teamId = teamId;
      const newTeam = await prisma.team.findUnique({ where: { id: teamId }, select: { seasonId: true } });
      if (newTeam?.seasonId) data.seasonId = newTeam.seasonId;
    }
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (nationality !== undefined) data.nationality = nationality;
    if (age !== undefined) data.age = age ? parseInt(age) : null;
    if (height !== undefined) data.height = height ? parseInt(height) : null;
    if (weight !== undefined) data.weight = weight ? parseInt(weight) : null;
    if (preferredFoot !== undefined) data.preferredFoot = preferredFoot;
    if (biography !== undefined) data.biography = biography;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const player = await prisma.player.update({ where: { id: req.params.id }, data });
    res.json(player);
  } catch (error) {
    next(error);
  }
};

export const deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await prisma.player.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json(player);
  } catch (error) {
    next(error);
  }
};

export const copyPlayersFromSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, fromSeasonId } = req.params;
    if (seasonId === fromSeasonId) throw new AppError("Cannot copy players from the same season", 400);

    const sourceTeams = await prisma.team.findMany({ where: { seasonId: fromSeasonId }, select: { id: true, slug: true, name: true } });
    const targetTeams = await prisma.team.findMany({ where: { seasonId }, select: { id: true, slug: true, name: true } });

    const teamSlugMap = new Map<string, string>();
    for (const t of sourceTeams) {
      const match = targetTeams.find((tt) => tt.slug === t.slug || tt.name === t.name);
      if (match) teamSlugMap.set(t.id, match.id);
    }

    const sourcePlayers = await prisma.player.findMany({
      where: { seasonId: fromSeasonId, isActive: true },
      select: {
        firstName: true, lastName: true, position: true, jerseyNumber: true,
        squadType: true, photoUrl: true, nationality: true, age: true,
        height: true, weight: true, preferredFoot: true, biography: true,
        teamId: true,
      },
    });

    let copied = 0;
    let skipped = 0;
    const rows: any[] = [];

    for (const p of sourcePlayers) {
      const targetTeamId = p.teamId ? teamSlugMap.get(p.teamId) : null;
      if (p.teamId && !targetTeamId) { skipped++; continue; }

      const slug = `${p.firstName.toLowerCase()}-${(p.lastName || "player").toLowerCase()}-${Date.now()}-${copied}`.replace(/[^a-z0-9-]+/g, "-");
      rows.push({
        firstName: p.firstName, lastName: p.lastName || "", slug,
        position: p.position, jerseyNumber: p.jerseyNumber, squadType: p.squadType,
        teamId: targetTeamId, seasonId, photoUrl: p.photoUrl, nationality: p.nationality,
        age: p.age, height: p.height, weight: p.weight, preferredFoot: p.preferredFoot,
        biography: p.biography, isActive: true,
      });
      copied++;
    }

    if (rows.length > 0) {
      await prisma.player.createMany({ data: rows });
    }

    res.json({ message: `Copied ${copied} players${skipped > 0 ? `, ${skipped} skipped (missing team in target season)` : ""}`, copied, skipped });
  } catch (error) {
    next(error);
  }
};

// ─── Fixtures Management ───

export const getFixtures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const { search } = req.query;
    const where: any = {};
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

const FIXTURE_WRITABLE_FIELDS = [
  "seasonId", "competitionId", "homeTeamId", "awayTeamId", "venueId",
  "matchDate", "kickoffTime", "round", "leagueWeek",
  "isGrandFinal", "isRelegationPlayoff", "referee", "referee2",
  "attendance", "stadium", "matchReport", "highlights", "isFeatured",
] as const;
// Deliberately excluded: status, homeScore, awayScore, and every live-match
// stat (homePossession, homeShots, ...). Those must be set through
// updateFixtureStatus / updateFixtureScore / the live-stats endpoints, which
// route through leagueSystem.processMatchResult so standings, suspensions,
// player stats, and awards get recalculated. Allowing them here let a caller
// mark a fixture COMPLETED with a score and silently skip that entire
// pipeline.

export const createFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pick(req.body, FIXTURE_WRITABLE_FIELDS);
    if (!data.seasonId || !data.homeTeamId || !data.awayTeamId || !data.matchDate) {
      throw new AppError("seasonId, homeTeamId, awayTeamId, and matchDate are required", 400);
    }
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
    const fixture = await prisma.fixture.update({
      where: { id: req.params.id },
      data,
    });
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

export const updateFixtureStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const allowed = ["SCHEDULED", "LIVE", "PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES", "COMPLETED", "CANCELLED", "POSTPONED"];
    if (!allowed.includes(status)) throw new AppError("Invalid fixture status", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (status === "LIVE" && fixture.status === "COMPLETED") throw new AppError("Completed fixtures cannot return to live", 400);
    if (status === "COMPLETED") {
      if (fixture.homeScore === null || fixture.awayScore === null) throw new AppError("Completed fixtures require scores", 400);
      await leagueSystem.processMatchResult(req.params.id, fixture.homeScore, fixture.awayScore);
    } else {
      await prisma.fixture.update({ where: { id: req.params.id }, data: { status } });
    }
    res.json(await prisma.fixture.findUnique({ where: { id: req.params.id } }));
  } catch (error) {
    next(error);
  }
};

export const updateFixtureScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeScore, awayScore } = req.body;
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      throw new AppError("Scores must be non-negative integers", 400);
    }
    await leagueSystem.processMatchResult(req.params.id, homeScore, awayScore);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

export const deleteFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.fixture.delete({ where: { id: req.params.id } });
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
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);

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

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

async function updateStanding(seasonId: string, teamId: string, goalsFor: number, goalsAgainst: number, result: string) {
  const standing = await prisma.standing.findUnique({
    where: { seasonId_teamId: { seasonId, teamId } },
  });

  const updates = {
    played: (standing?.played || 0) + 1,
    goalsFor: (standing?.goalsFor || 0) + goalsFor,
    goalsAgainst: (standing?.goalsAgainst || 0) + goalsAgainst,
    goalDifference: ((standing?.goalsFor || 0) + goalsFor) - ((standing?.goalsAgainst || 0) + goalsAgainst),
    form: ((standing?.form || "") + result).slice(-5),
  };

  if (result === "W") {
    Object.assign(updates, { wins: (standing?.wins || 0) + 1, points: (standing?.points || 0) + 3 });
  } else if (result === "D") {
    Object.assign(updates, { draws: (standing?.draws || 0) + 1, points: (standing?.points || 0) + 1 });
  } else {
    Object.assign(updates, { losses: (standing?.losses || 0) + 1 });
  }

  await prisma.standing.upsert({
    where: { seasonId_teamId: { seasonId, teamId } },
    create: { seasonId, teamId, ...updates, position: 0 },
    update: updates,
  });

  // Recalculate positions
  const standings = await prisma.standing.findMany({
    where: { seasonId },
    orderBy: [{ points: "desc" }, { goalDifference: "desc" }, { goalsFor: "desc" }],
  });
  for (let i = 0; i < standings.length; i++) {
    await prisma.standing.update({
      where: { id: standings[i].id },
      data: { position: i + 1 },
    });
  }
}

function calculateMatchStats(homeScore: number, awayScore: number) {
  const home = homeScore > awayScore ? "W" : homeScore < awayScore ? "L" : "D";
  const away = awayScore > homeScore ? "W" : awayScore < homeScore ? "L" : "D";
  return { home, away };
}

// ─── Awards Management ───

export const getAwards = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const awards = await prisma.award.findMany({
      include: { winner: { select: { firstName: true, lastName: true, photoUrl: true } }, winnerTeam: { select: { name: true, logoUrl: true } }, _count: { select: { votes: true, nominations: true } } },
      orderBy: { name: "asc" },
    });
    res.json(awards);
  } catch (error) {
    next(error);
  }
};

const AWARD_WRITABLE_FIELDS = [
  "seasonId", "name", "slug", "description", "trophyImageUrl", "rules",
  "eligibilityCriteria", "votingEnabled", "votingType", "voteFrequency",
  "allowAnonymous", "requireOTP", "requireEmailVerification", "requireCaptcha",
  "ipProtection", "deviceFingerprint", "voteModeration", "manualApproval",
  "hiddenVoteMode", "hideResultsUntil", "votingStartDate", "votingEndDate",
  "autoCloseVoting", "autoAnnounceWinner", "isActive", "type",
] as const;
// Deliberately excluded: winnerAnnounced, winnerId, winnerTeamId — those may
// only be set through announceWinner(), which also records a PreviousWinner
// entry consistently.

export const createAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const data = pick(req.body, AWARD_WRITABLE_FIELDS);
    if (!data.seasonId || !data.name || !data.slug) {
      throw new AppError("seasonId, name, and slug are required", 400);
    }
    const award = await prisma.award.create({
      data: { ...data, managedById: userId } as any,
    });
    res.status(201).json(award);
  } catch (error) {
    next(error);
  }
};

export const updateAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const award = await prisma.award.update({
      where: { id: req.params.id },
      data: pick(req.body, AWARD_WRITABLE_FIELDS) as any,
    });
    res.json(award);
  } catch (error) {
    next(error);
  }
};

export const deleteAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.award.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const toggleVoting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const award = await prisma.award.update({
      where: { id: req.params.id },
      data: { votingEnabled: req.body.enabled },
    });
    res.json(award);
  } catch (error) {
    next(error);
  }
};

export const addNomination = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pick(req.body, ["awardId", "playerId", "reason"] as const);
    if (!data.awardId || !data.playerId) throw new AppError("awardId and playerId are required", 400);
    const nomination = await prisma.awardNomination.create({ data: data as any });
    res.status(201).json(nomination);
  } catch (error) {
    next(error);
  }
};

export const announceWinner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, teamId, seasonId } = req.body;
    const award = await prisma.award.findUnique({ where: { id: req.params.id } });
    if (!award) return res.status(404).json({ error: "Award not found" });

    const data: any = {
      winnerAnnounced: true,
      previousWinners: {
        create: {
          seasonId,
          year: new Date().getFullYear().toString(),
        },
      },
    };

    if (award.type === "TEAM") {
      data.winnerTeamId = teamId;
      data.winnerId = null;
      data.previousWinners.create.teamId = teamId;
    } else {
      data.winnerId = playerId;
      data.winnerTeamId = null;
      data.previousWinners.create.playerId = playerId;
    }

    const updated = await prisma.award.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─── CMS ───

export const getNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const { search } = req.query;
    const where: any = {};
    if (search) where.OR = [
      { title: { contains: search as string, mode: "insensitive" } },
      { author: { contains: search as string, mode: "insensitive" } },
      { excerpt: { contains: search as string, mode: "insensitive" } },
    ];
    const [data, total] = await Promise.all([
      prisma.news.findMany({
        where,
        include: { team: { select: { name: true, slug: true } } },
        skip, take: limit,
        orderBy: { publishedAt: "desc" },
      }),
      prisma.news.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

const NEWS_WRITABLE_FIELDS = [
  "seasonId", "teamId", "title", "slug", "excerpt", "content", "imageUrl",
  "author", "isFeatured", "isPublished", "publishedAt",
] as const;

export const createNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, NEWS_WRITABLE_FIELDS);
    if (!data.title || !data.slug) throw new AppError("title and slug are required", 400);
    if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
    const news = await prisma.news.create({ data });
    res.status(201).json(news);
  } catch (error) {
    next(error);
  }
};

export const updateNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, NEWS_WRITABLE_FIELDS);
    if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
    const news = await prisma.news.update({
      where: { id: req.params.id },
      data,
    });
    res.json(news);
  } catch (error) {
    next(error);
  }
};

export const deleteNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getGalleryItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.gallery.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

const GALLERY_WRITABLE_FIELDS = [
  "seasonId", "teamId", "playerId", "fixtureId", "awardId", "title", "imageUrl", "videoUrl", "isActive",
] as const;

export const manageGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, GALLERY_WRITABLE_FIELDS);
    if (!data.title || !data.imageUrl) throw new AppError("title and imageUrl are required", 400);
    const item = await prisma.gallery.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteGalleryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const SPONSOR_WRITABLE_FIELDS = ["teamId", "name", "logoUrl", "website", "tier", "isActive"] as const;

export const manageSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, SPONSOR_WRITABLE_FIELDS);
    if (!data.name || !data.logoUrl) throw new AppError("name and logoUrl are required", 400);
    const sponsor = await prisma.sponsor.create({ data });
    res.status(201).json(sponsor);
  } catch (error) {
    next(error);
  }
};

export const updateSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsor = await prisma.sponsor.update({
      where: { id: req.params.id },
      data: pick(req.body, SPONSOR_WRITABLE_FIELDS) as any,
    });
    res.json(sponsor);
  } catch (error) {
    next(error);
  }
};

export const getSponsors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
    ];
    const sponsors = await prisma.sponsor.findMany({ where, orderBy: { tier: "asc" } });
    res.json({ data: sponsors });
  } catch (error) {
    next(error);
  }
};

export const deleteSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.sponsor.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json(map);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = Object.entries(req.body).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    );
    await Promise.all(updates);
    res.json({ message: "Settings updated" });
  } catch (error) {
    next(error);
  }
};

// ─── Users Management ───

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = {};
    if (req.query.role) where.role = req.query.role;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

const VALID_USER_ROLES = [
  "SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER", "CONTENT_EDITOR",
  "REFEREE", "STATISTICIAN", "VIEWER", "CUSTOMER",
] as const;

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    if (!VALID_USER_ROLES.includes(role)) throw new AppError("Invalid role", 400);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// ─── Dashboard Analytics ───

function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;
  switch (period) {
    case "week":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { start, end };
}

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || "today";
    const { start: periodStart, end: periodEnd } = getPeriodRange(period);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalUsers, totalBookings, totalTeams, totalPlayers,
      totalFixtures, totalRevenue, activeBookings, recentFixtures,
      todayFixtures, recentBookings, activity, venues,
      periodBookings, periodRevenue, periodCancellations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.fixture.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.fixture.findMany({
        take: 5,
        orderBy: { matchDate: "desc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.fixture.findMany({
        where: { matchDate: { gte: todayStart, lte: todayEnd } },
        orderBy: { matchDate: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          turf: { include: { venue: { select: { name: true } } } },
          payments: true,
        },
      }),
      prisma.activityLog.findMany({
        take: 20,
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.venue.findMany({
        include: { turfs: { where: { isActive: true } }, _count: { select: { turfs: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.booking.count({
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { booking: { date: { gte: periodStart, lte: periodEnd } } },
      }),
      prisma.booking.count({
        where: { date: { gte: periodStart, lte: periodEnd }, status: "CANCELLED" },
      }),
    ]);

    res.json({
      stats: {
        totalUsers, totalBookings, totalTeams, totalPlayers,
        totalFixtures, totalRevenue: totalRevenue._sum.amount || 0,
        activeBookings,
      },
      periodStats: {
        period,
        bookings: periodBookings,
        revenue: periodRevenue._sum.amount || 0,
        cancellations: periodCancellations,
      },
      recentFixtures,
      todayFixtures,
      recentBookings,
      activity,
      venues,
    });
  } catch (error) {
    next(error);
  }
};

export const getActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        include: { user: { select: { firstName: true, lastName: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

// ─── Venue Management ───

export const getVenues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { city: { contains: search as string, mode: "insensitive" } },
    ];
    const venues = await prisma.venue.findMany({
      where,
      include: { turfs: { where: { isActive: true } }, _count: { select: { turfs: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ data: venues });
  } catch (error) {
    next(error);
  }
};

const VENUE_WRITABLE_FIELDS = [
  "name", "slug", "description", "address", "city", "state", "country", "zipCode",
  "latitude", "longitude", "phone", "email", "coverImage", "logo", "rules", "faqs",
  "isActive", "openingTime", "closingTime",
] as const;

export const createVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, VENUE_WRITABLE_FIELDS);
    if (!data.name || !data.slug || !data.address || !data.city || !data.state) {
      throw new AppError("name, slug, address, city, and state are required", 400);
    }
    const venue = await prisma.venue.create({ data });
    res.status(201).json(venue);
  } catch (error) {
    next(error);
  }
};

export const updateVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venue = await prisma.venue.update({ where: { id: req.params.id }, data: pick(req.body, VENUE_WRITABLE_FIELDS) as any });
    res.json(venue);
  } catch (error) {
    next(error);
  }
};

export const deleteVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.venue.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── Turf Management ───

const TURF_WRITABLE_FIELDS = [
  "venueId", "name", "description", "size", "surface", "isActive",
  "basePrice", "peakPrice", "weekendPrice", "imageUrl", "capacity",
] as const;

export const createTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, TURF_WRITABLE_FIELDS);
    if (!data.venueId || !data.name) throw new AppError("venueId and name are required", 400);
    const turf = await prisma.turf.create({ data });
    res.status(201).json(turf);
  } catch (error) {
    next(error);
  }
};

export const updateTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const turf = await prisma.turf.update({ where: { id: req.params.id }, data: pick(req.body, TURF_WRITABLE_FIELDS) as any });
    res.json(turf);
  } catch (error) {
    next(error);
  }
};

export const deleteTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.turf.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── League System Operations ───

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

export const adminOpenTransferWindow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    await leagueSystem.openTransferWindow(req.params.id, days);
    res.json({ message: `Transfer window opened for ${days} days` });
  } catch (error) {
    next(error);
  }
};

export const adminCloseTransferWindow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await leagueSystem.closeTransferWindow(req.params.id);
    res.json({ message: "Transfer window closed" });
  } catch (error) {
    next(error);
  }
};

export const adminCreateNextSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) throw new AppError("name, startDate, endDate required", 400);
    const newSeasonId = await leagueSystem.createNextSeason(req.params.id, name, new Date(startDate), new Date(endDate));
    res.status(201).json({ id: newSeasonId });
  } catch (error) {
    next(error);
  }
};

export const adminSelectMatchdaySquad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, playerIds } = req.body;
    if (!teamId || !playerIds) throw new AppError("teamId and playerIds required", 400);
    await leagueSystem.selectMatchdaySquad(req.params.id, teamId, playerIds);
    res.json({ message: "Matchday squad selected" });
  } catch (error) {
    next(error);
  }
};

export const adminValidateSquad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId } = req.query;
    if (!seasonId) throw new AppError("seasonId query param required", 400);
    const result = await leagueSystem.validateSquad(req.params.id, seasonId as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adminProcessMatchResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeScore, awayScore } = req.body;
    if (homeScore === undefined || awayScore === undefined) throw new AppError("homeScore and awayScore required", 400);
    await leagueSystem.processMatchResult(req.params.id, homeScore, awayScore);
    res.json({ message: "Match result processed" });
  } catch (error) {
    next(error);
  }
};

// ─── Live Match Stats ───

export const getLiveStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const homePlayers = await prisma.player.findMany({
      where: { teamId: fixture.homeTeamId, seasonId: fixture.seasonId, isActive: true },
      include: {
        homeStats: { where: { seasonId: fixture.seasonId } },
        cards: { where: { fixtureId: fixture.id } },
      },
      orderBy: { jerseyNumber: "asc" },
    });

    const awayPlayers = await prisma.player.findMany({
      where: { teamId: fixture.awayTeamId, seasonId: fixture.seasonId, isActive: true },
      include: {
        homeStats: { where: { seasonId: fixture.seasonId } },
        cards: { where: { fixtureId: fixture.id } },
      },
      orderBy: { jerseyNumber: "asc" },
    });

      const goals = await prisma.goal.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });
    const assists = await prisma.assist.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });
    const cards = await prisma.card.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });
    const substitutions = await prisma.substitution.findMany({ where: { fixtureId: fixture.id }, include: { playerOff: { select: { id: true, firstName: true, lastName: true } }, playerOn: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { minute: "asc" } });

    const formatPlayer = (p: any) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: p.jerseyNumber,
      position: p.position,
      photoUrl: p.photoUrl,
      squadType: p.squadType,
      stats: {
        goals: goals.filter((g: any) => g.playerId === p.id).length,
        assists: assists.filter((a: any) => a.playerId === p.id).length,
        yellowCards: cards.filter((c: any) => c.playerId === p.id && c.type === "YELLOW").length,
        redCards: cards.filter((c: any) => c.playerId === p.id && (c.type === "RED" || c.type === "SECOND_YELLOW")).length,
      },
    });

    res.json({
      fixture: { id: fixture.id, matchDate: fixture.matchDate, status: fixture.status, homeScore: fixture.homeScore, awayScore: fixture.awayScore },
      homeTeam: { ...fixture.homeTeam, players: homePlayers.map(formatPlayer) },
      awayTeam: { ...fixture.awayTeam, players: awayPlayers.map(formatPlayer) },
      matchStats: { goals, assists, cards, substitutions },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLiveStat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, statType, teamId, action } = req.body;
    if (!playerId || !statType || !teamId || !action) throw new AppError("playerId, statType, teamId, action required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
    if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId) || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Player or team does not belong to this fixture", 400);
    }

    const isIncrement = action === "increment";

    if (statType === "goal") {
      const existing = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const goal = await prisma.goal.create({
          data: { fixtureId: fixture.id, playerId, minute: 0 },
        });
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "added", goal, count: goalCount });
      } else {
        if (existing) {
          await prisma.goal.delete({ where: { id: existing.id } });
        }
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "removed", count: goalCount });
      }
    } else if (statType === "assist") {
      const existing = await prisma.assist.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const assist = await prisma.assist.create({
          data: { fixtureId: fixture.id, playerId, minute: 0 },
        });
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "added", assist, count });
      } else {
        if (existing) {
          await prisma.assist.delete({ where: { id: existing.id } });
        }
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "removed", count });
      }
    } else if (statType === "yellowCard" || statType === "redCard") {
      const cardType = statType === "yellowCard" ? "YELLOW" : "RED";
      const existing = await prisma.card.findFirst({ where: { fixtureId: fixture.id, playerId, type: cardType }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const card = await prisma.card.create({
          data: { fixtureId: fixture.id, playerId, type: cardType, minute: 0 },
        });
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "added", card, count });
      } else {
        if (existing) {
          await prisma.card.delete({ where: { id: existing.id } });
        }
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "removed", count });
      }
    } else {
      throw new AppError("Invalid statType", 400);
    }
  } catch (error) {
    next(error);
  }
};

// ─── Goal & Substitution Management ───

export const addGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, scorerId, assistId, minute } = req.body;
    if (!teamId || !scorerId) throw new AppError("teamId and scorerId required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const scorer = await prisma.player.findUnique({ where: { id: scorerId }, select: { teamId: true } });
    if (!scorer || scorer.teamId !== teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Scorer does not belong to this fixture", 400);
    }
    if (assistId) {
      const assister = await prisma.player.findUnique({ where: { id: assistId }, select: { teamId: true } });
      if (!assister || assister.teamId !== teamId) throw new AppError("Assister must belong to the scoring team", 400);
    }

    const goal = await prisma.goal.create({
      data: { fixtureId: fixture.id, playerId: scorerId, minute: minute || 0 },
    });

    if (assistId) {
      await prisma.assist.create({
        data: { fixtureId: fixture.id, playerId: assistId, minute: minute || 0 },
      });
    }

    await recalcScore(fixture.id);
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
};

export const removeGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.body;
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const goal = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
    if (!goal) throw new AppError("No goal found for this player", 404);

    const assist = await prisma.assist.findFirst({ where: { fixtureId: fixture.id }, orderBy: { createdAt: "desc" } });
    if (assist) {
      const goalTime = goal.createdAt;
      const assistTime = assist.createdAt;
      if (Math.abs(assistTime.getTime() - goalTime.getTime()) < 1000) {
        await prisma.assist.delete({ where: { id: assist.id } });
      }
    }

    await prisma.goal.delete({ where: { id: goal.id } });
    await recalcScore(fixture.id);
    res.json({ message: "Goal removed" });
  } catch (error) {
    next(error);
  }
};

export const addSubstitution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, playerOffId, playerOnId, minute } = req.body;
    if (!teamId || !playerOffId || !playerOnId) throw new AppError("teamId, playerOffId, playerOnId required", 400);
    if (playerOffId === playerOnId) throw new AppError("Cannot substitute a player with themselves", 400);
    const players = await prisma.player.findMany({ where: { id: { in: [playerOffId, playerOnId] }, teamId }, select: { id: true } });
    if (players.length !== 2) throw new AppError("Both players must belong to the selected team", 400);

    const sub = await prisma.substitution.create({
      data: { fixtureId: req.params.id, playerOffId, playerOnId, minute: minute || 0 },
    });
    res.status(201).json(sub);
  } catch (error) {
    next(error);
  }
};

// ─── Suspensions Management ───

export const adminGetSuspensions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, teamId } = req.query;
    const { page, limit, skip } = paginate(req.query);
    const where: any = {};
    if (seasonId) where.seasonId = seasonId;
    if (teamId) where.player = { teamId: teamId as string };
    const [data, total] = await Promise.all([
      prisma.suspension.findMany({
        where,
        include: {
          player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, team: { select: { id: true, name: true, shortName: true, logoUrl: true } } } },
          season: { select: { id: true, name: true } },
        },
        skip, take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.suspension.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const adminCreateSuspension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, seasonId, reason, matchBan, notes } = req.body;
    if (!playerId || !seasonId || !reason) return res.status(400).json({ error: "playerId, seasonId, and reason are required" });
    const suspension = await prisma.suspension.create({
      data: {
        playerId, seasonId, reason, matchBan: matchBan || 1, notes: notes || "",
        startDate: new Date(), endDate: new Date(Date.now() + (matchBan || 1) * 7 * 86400000),
        isActive: true,
      },
    });
    res.status(201).json(suspension);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateSuspension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchBan, reason, notes, isActive } = req.body;
    const data: any = {};
    if (matchBan !== undefined) data.matchBan = matchBan;
    if (reason !== undefined) data.reason = reason;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = isActive;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const suspension = await prisma.suspension.update({ where: { id: req.params.id }, data });
    res.json(suspension);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteSuspension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.suspension.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const updateGalleryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.gallery.update({ where: { id: req.params.id }, data: pick(req.body, GALLERY_WRITABLE_FIELDS) as any });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const COUPON_WRITABLE_FIELDS = [
  "code", "discountType", "discountValue", "maxUses", "minAmount", "expiresAt", "isActive",
] as const;
// usedCount is deliberately excluded — it must only ever be incremented by
// the coupon-redemption logic itself, never set directly by an admin request.

export const getCoupons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, COUPON_WRITABLE_FIELDS);
    if (!data.code || !data.discountType || data.discountValue === undefined) {
      throw new AppError("code, discountType, and discountValue are required", 400);
    }
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    const item = await prisma.coupon.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, COUPON_WRITABLE_FIELDS);
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    const item = await prisma.coupon.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const AD_WRITABLE_FIELDS = ["title", "imageUrl", "linkUrl", "position", "isActive", "startsAt", "endsAt"] as const;

export const getAdvertisements = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.advertisement.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createAdvertisement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, AD_WRITABLE_FIELDS);
    if (!data.title || !data.imageUrl) throw new AppError("title and imageUrl are required", 400);
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    const item = await prisma.advertisement.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateAdvertisement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, AD_WRITABLE_FIELDS);
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    const item = await prisma.advertisement.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteAdvertisement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.advertisement.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const FAQ_WRITABLE_FIELDS = ["question", "answer", "category", "order", "isActive"] as const;

export const getFaqs = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.faq.findMany({ orderBy: { order: "asc" } });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, FAQ_WRITABLE_FIELDS);
    if (!data.question || !data.answer) throw new AppError("question and answer are required", 400);
    const item = await prisma.faq.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.faq.update({ where: { id: req.params.id }, data: pick(req.body, FAQ_WRITABLE_FIELDS) as any });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.faq.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getReviews = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } }, venue: { select: { name: true } } },
    });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const approveReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.review.update({ where: { id: req.params.id }, data: { isApproved: true } });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const searchPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, teamId } = req.query;
    if (!q || typeof q !== "string" || q.length < 2) {
      return res.json([]);
    }
    const { ids } = await searchPlayerIds(q, {
      teamId: teamId as string, limit: 10,
    });
    if (ids.length === 0) return res.json([]);
    const players = await prisma.player.findMany({
      where: { id: { in: ids } },
      include: { team: { select: { name: true } } },
      orderBy: { firstName: "asc" },
    });
    res.json(players);
  } catch (error) {
    next(error);
  }
};

async function recalcScore(fixtureId: string) {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { homeTeamId: true, awayTeamId: true } });
  if (!fixture) return;
  const homeGoals = await prisma.goal.count({
    where: { fixtureId, player: { teamId: fixture.homeTeamId } },
  });
  const awayGoals = await prisma.goal.count({
    where: { fixtureId, player: { teamId: fixture.awayTeamId } },
  });
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { homeScore: homeGoals, awayScore: awayGoals },
  });
}

export const adminSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ data: [] });

    const [teams, players, venues, bookings, fixtures, news, sponsors, users] = await Promise.all([
      prisma.team.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 }),
      (async () => {
        const { ids } = await searchPlayerIds(q, { limit: 5 });
        if (ids.length === 0) return [];
        return prisma.player.findMany({
          where: { id: { in: ids } },
          include: { team: { select: { name: true } } },
        });
      })(),
      prisma.venue.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 }),
      prisma.booking.findMany({
        where: { bookingNumber: { contains: q, mode: "insensitive" } },
        include: { user: { select: { firstName: true, lastName: true } }, turf: { include: { venue: { select: { name: true } } } } },
        take: 5,
      }),
      prisma.fixture.findMany({
        where: { OR: [{ homeTeam: { name: { contains: q, mode: "insensitive" } } }, { awayTeam: { name: { contains: q, mode: "insensitive" } } }] },
        include: { homeTeam: { select: { shortName: true } }, awayTeam: { select: { shortName: true } } },
        take: 5,
      }),
      prisma.news.findMany({ where: { title: { contains: q, mode: "insensitive" } }, take: 5 }),
      prisma.sponsor.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 }),
      prisma.user.findMany({
        where: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
        take: 5,
      }),
    ]);

    const results: any[] = [];
    teams.forEach((t) => results.push({ id: t.id, label: t.name, description: "Team", type: "team" }));
    players.forEach((p) => results.push({ id: p.id, label: `${p.firstName} ${p.lastName}`, description: `Player — ${p.team?.name || "No team"}`, type: "player" }));
    venues.forEach((v) => results.push({ id: v.id, label: v.name, description: "Venue", type: "venue" }));
    bookings.forEach((b) => results.push({ id: b.id, label: `#${b.bookingNumber}`, description: `${b.turf?.venue?.name || "Venue"} — ${b.user?.firstName || ""} ${b.user?.lastName || ""}`, type: "booking" }));
    fixtures.forEach((f) => results.push({ id: f.id, label: `${f.homeTeam?.shortName || "?"} vs ${f.awayTeam?.shortName || "?"}`, description: "Fixture", type: "fixture" }));
    news.forEach((n) => results.push({ id: n.id, label: n.title, description: "News", type: "news" }));
    sponsors.forEach((s) => results.push({ id: s.id, label: s.name, description: "Sponsor", type: "sponsor" }));
    users.forEach((u) => results.push({ id: u.id, label: `${u.firstName} ${u.lastName}`, description: `User — ${u.email}`, type: "user" }));

    res.json({ data: results });
  } catch (error) {
    next(error);
  }
};
