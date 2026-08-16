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
    // Create the zeroed standing row immediately so the new team is visible
    // on the league dashboard before its first completed fixture.
    await leagueSystem.recalculateStandings(team.seasonId);
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
    const current = await prisma.team.findUnique({ where: { id: req.params.id }, select: { seasonId: true } });
    if (!current) throw new AppError("Team not found", 404);
    if (data.seasonId) {
      const season = await prisma.season.findUnique({ where: { id: data.seasonId }, select: { id: true } });
      if (!season) throw new AppError("Season not found", 404);
    }
    if (status !== undefined) data.isActive = status !== "inactive";
    try {
      const team = await prisma.team.update({ where: { id: req.params.id }, data });
      if (current.seasonId !== team.seasonId || status !== undefined) {
        await leagueSystem.recalculateStandings(current.seasonId);
        if (current.seasonId !== team.seasonId) await leagueSystem.recalculateStandings(team.seasonId);
      }
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
    const existing = await prisma.team.findUnique({ where: { id: req.params.id }, select: { seasonId: true } });
    if (!existing) throw new AppError("Team not found", 404);
    const team = await prisma.team.update({ where: { id: req.params.id }, data: { isActive: false, status: "inactive" } });
    await leagueSystem.recalculateStandings(existing.seasonId);
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
    const where: any = req.query.includeInactive === "true" ? {} : { isActive: true };
    if (teamId) where.teamId = teamId;
    if (seasonId) where.seasonId = seasonId;
    if (search) {
      const { ids, total } = await searchPlayerIds(search as string, {
        teamId: teamId as string, seasonId: seasonId as string,
        isActive: where.isActive,
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
    const { firstName, lastName, position, teamId, jerseyNumber, squadType, photoUrl, nationality, age, height, weight, preferredFoot, biography, transferReason } = req.body;
    const current = await prisma.player.findUnique({ where: { id: req.params.id }, select: { teamId: true, seasonId: true } });
    if (!current) throw new AppError("Player not found", 404);
    if (firstName !== undefined && !String(firstName).trim()) throw new AppError("First name is required", 400);
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
    if (jerseyNumber !== undefined) data.jerseyNumber = jerseyNumber === "" || jerseyNumber === null ? null : parseInt(jerseyNumber);
    if (squadType !== undefined) data.squadType = squadType === "" || squadType === null ? null : squadType;
    if (teamId !== undefined) {
      if (!teamId) throw new AppError("A team is required", 400);
      const newTeam = await prisma.team.findUnique({ where: { id: teamId }, select: { seasonId: true } });
      if (!newTeam) throw new AppError("Team not found", 404);
      data.teamId = teamId;
      data.seasonId = newTeam.seasonId;
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
    if (teamId !== undefined && teamId !== current.teamId) {
      await prisma.playerTransfer.create({
        data: {
          playerId: req.params.id,
          fromTeamId: current.teamId,
          toTeamId: teamId,
          fromSeasonId: current.seasonId,
          toSeasonId: data.seasonId,
          reason: transferReason ? String(transferReason).trim() : null,
          createdById: req.user?.userId,
        },
      });
    }
    res.json(player);
  } catch (error) {
    next(error);
  }
};

export const deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.player.findUnique({ where: { id: req.params.id }, select: { id: true, isActive: true } });
    if (!existing) throw new AppError("Player not found", 404);
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

export const getCompetitions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competitions = await prisma.competition.findMany({
      where: req.query.seasonId ? { seasonId: String(req.query.seasonId) } : undefined,
      include: { season: { select: { id: true, name: true } }, _count: { select: { fixtures: true, bracketMatches: true } } },
      orderBy: [{ seasonId: "desc" }, { name: "asc" }],
    });
    res.json(competitions);
  } catch (error) { next(error); }
};

export const getCompetitionBracket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        season: { select: { id: true, name: true } },
        bracketMatches: {
          include: {
            homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
            winnerTeam: { select: { id: true, name: true, shortName: true } },
            fixture: { select: { id: true, matchDate: true, kickoffTime: true, status: true, homeScore: true, awayScore: true } },
          },
          orderBy: [{ roundNumber: "asc" }, { position: "asc" }],
        },
      },
    });
    if (!competition) throw new AppError("Competition not found", 404);
    res.json(competition);
  } catch (error) { next(error); }
};

export const generateCompetitionBracket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamIds, matchDate, kickoffTime } = req.body;
    if (!Array.isArray(teamIds) || teamIds.length < 2 || teamIds.length > 32 || (teamIds.length & (teamIds.length - 1)) !== 0) {
      throw new AppError("A knockout bracket requires 2, 4, 8, 16, or 32 teams", 400);
    }
    if (new Set(teamIds).size !== teamIds.length) throw new AppError("Bracket teams must be unique", 400);
    const competition = await prisma.competition.findUnique({ where: { id: req.params.id } });
    if (!competition) throw new AppError("Competition not found", 404);
    if (competition.type !== "KNOCKOUT" && competition.type !== "CUP") throw new AppError("Only knockout or cup competitions can have brackets", 400);
    const existing = await prisma.bracketMatch.count({ where: { competitionId: competition.id } });
    if (existing) throw new AppError("This competition already has a bracket", 409);
    const teams = await prisma.team.findMany({ where: { id: { in: teamIds }, seasonId: competition.seasonId, isActive: true }, select: { id: true } });
    if (teams.length !== teamIds.length) throw new AppError("All bracket teams must be active teams from the competition season", 400);
    const baseDate = matchDate ? new Date(matchDate) : new Date();
    if (Number.isNaN(baseDate.getTime())) throw new AppError("Invalid first-round match date", 400);
    const rounds = Math.log2(teamIds.length);
    const created = await prisma.$transaction(async (tx) => {
      const rows: any[] = [];
      for (let round = 1; round <= rounds; round++) {
        const matchCount = teamIds.length / (2 ** round);
        for (let position = 1; position <= matchCount; position++) {
          const homeTeamId = round === 1 ? teamIds[(position - 1) * 2] : null;
          const awayTeamId = round === 1 ? teamIds[(position - 1) * 2 + 1] : null;
          const row = await tx.bracketMatch.create({ data: { competitionId: competition.id, roundNumber: round, position, homeTeamId, awayTeamId } });
          if (round === 1 && homeTeamId && awayTeamId) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + position - 1);
            const fixture = await tx.fixture.create({ data: { seasonId: competition.seasonId, competitionId: competition.id, homeTeamId, awayTeamId, matchDate: date, kickoffTime: kickoffTime || null, round, status: "SCHEDULED" } });
            await tx.bracketMatch.update({ where: { id: row.id }, data: { fixtureId: fixture.id } });
            rows.push({ ...row, fixtureId: fixture.id });
          } else rows.push(row);
        }
      }
      await tx.competition.update({ where: { id: competition.id }, data: { bracketSize: teamIds.length, bracketStatus: "IN_PROGRESS" } });
      return rows;
    });
    res.status(201).json({ competitionId: competition.id, bracketSize: teamIds.length, matches: created });
  } catch (error) { next(error); }
};

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

export const getStandingAdjustments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.query.seasonId) throw new AppError("seasonId is required", 400);
    const adjustments = await prisma.standingAdjustment.findMany({ where: { seasonId: String(req.query.seasonId) }, include: { team: { select: { id: true, name: true, logoUrl: true } } }, orderBy: { createdAt: "desc" } });
    res.json(adjustments);
  } catch (error) { next(error); }
};

export const createStandingAdjustment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, teamId, pointsDelta = 0, goalsForDelta = 0, goalsAgainstDelta = 0, reason } = req.body;
    if (!seasonId || !teamId || !reason || !String(reason).trim()) throw new AppError("seasonId, teamId, and reason are required", 400);
    for (const value of [pointsDelta, goalsForDelta, goalsAgainstDelta]) if (!Number.isInteger(value)) throw new AppError("Standing adjustments must be integers", 400);
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { seasonId: true } });
    if (!team || team.seasonId !== seasonId) throw new AppError("Team does not belong to this season", 400);
    const adjustment = await prisma.standingAdjustment.create({ data: { seasonId, teamId, pointsDelta, goalsForDelta, goalsAgainstDelta, reason: String(reason).trim(), createdById: req.user?.userId } });
    await leagueSystem.recalculateStandings(seasonId);
    res.status(201).json(adjustment);
  } catch (error) { next(error); }
};

export const deleteStandingAdjustment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adjustment = await prisma.standingAdjustment.findUnique({ where: { id: req.params.id } });
    if (!adjustment) throw new AppError("Standing adjustment not found", 404);
    await prisma.standingAdjustment.delete({ where: { id: adjustment.id } });
    await leagueSystem.recalculateStandings(adjustment.seasonId);
    res.status(204).end();
  } catch (error) { next(error); }
};

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
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { booking: { status: { not: "CANCELLED" } } },
      }),
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
        where: {
          booking: { date: { gte: periodStart, lte: periodEnd }, status: { not: "CANCELLED" } },
        },
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
  "isActive", "openingTime", "closingTime", "lastBookingTime", "bookingMessageTemplate",
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
  "basePrice", "peakPrice", "weekendPrice", "halfHourBilling", "imageUrl", "capacity",
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

// ─── Live Match Stats ───

export const getLiveStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        competition: { select: { name: true } },
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

      const goals = await prisma.goal.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } } });
    const assists = await prisma.assist.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } } });
    const cards = await prisma.card.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } } });
    const substitutions = await prisma.substitution.findMany({ where: { fixtureId: fixture.id }, include: { playerOff: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } }, playerOn: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } }, orderBy: { minute: "asc" } });
    const notes = await prisma.matchNote.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, teamId: true } } }, orderBy: { minute: "asc" } });
    const ratings = await prisma.matchPlayerRating.findMany({ where: { fixtureId: fixture.id }, select: { playerId: true, rating: true } });
    const lineups = await prisma.lineup.findMany({ where: { fixtureId: fixture.id } });
    const lineupByPlayer = new Map(lineups.map((l) => [l.playerId, l]));
    const hasLineup = lineups.length > 0;

    const inMatchSquad = (p: any) => !hasLineup || lineupByPlayer.has(p.id);

    const formatPlayer = (p: any) => {
      const lu = lineupByPlayer.get(p.id);
      return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: lu?.jerseyNumber ?? p.jerseyNumber,
      position: lu?.role ?? p.position,
      photoUrl: p.photoUrl,
      squadType: p.squadType,
      inLineup: !!lu,
      isStarter: hasLineup ? !!lu?.isStarter : (p.squadType ? p.squadType === "STARTER" : true),
      isCaptain: lu?.isCaptain ?? false,
      isGoalkeeper: lu?.isGoalkeeper ?? (p.position === "GK"),
      role: lu?.role ?? null,
      stats: {
        goals: goals.filter((g: any) => g.playerId === p.id).length,
        assists: assists.filter((a: any) => a.playerId === p.id).length,
        yellowCards: cards.filter((c: any) => c.playerId === p.id && c.type === "YELLOW").length,
        redCards: cards.filter((c: any) => c.playerId === p.id && (c.type === "RED" || c.type === "SECOND_YELLOW")).length,
      },
      };
    };

    const homeSquad = homePlayers.filter(inMatchSquad);
    const awaySquad = awayPlayers.filter(inMatchSquad);

    res.json({
      fixture: {
        id: fixture.id,
        matchDate: fixture.matchDate,
        status: fixture.status,
        matchClockSeconds: fixture.matchClockSeconds + (fixture.status === "LIVE" && fixture.matchClockStartedAt
          ? Math.max(0, Math.floor((Date.now() - fixture.matchClockStartedAt.getTime()) / 1000)) : 0),
        kickoffTime: fixture.kickoffTime,
        round: fixture.round,
        stadium: fixture.stadium,
        competition: fixture.competition,
        manOfTheMatchId: fixture.manOfTheMatchId,
        matchPlayerRatings: Object.fromEntries(ratings.map((r) => [r.playerId, r.rating])),
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        homePossession: fixture.homePossession,
        awayPossession: fixture.awayPossession,
        homeShots: fixture.homeShots,
        awayShots: fixture.awayShots,
        homeShotsOnTarget: fixture.homeShotsOnTarget,
        awayShotsOnTarget: fixture.awayShotsOnTarget,
        homeCorners: fixture.homeCorners,
        awayCorners: fixture.awayCorners,
        homeFouls: fixture.homeFouls,
        awayFouls: fixture.awayFouls,
        homeOffsides: fixture.homeOffsides,
        awayOffsides: fixture.awayOffsides,
        homeExpectedGoals: fixture.homeExpectedGoals,
        awayExpectedGoals: fixture.awayExpectedGoals,
      },
      homeTeam: { ...fixture.homeTeam, players: homeSquad.map(formatPlayer) },
      awayTeam: { ...fixture.awayTeam, players: awaySquad.map(formatPlayer) },
      matchStats: { goals, assists, cards, substitutions, notes },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLiveStat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, statType, teamId, action, minute } = req.body;
    if (!playerId || !statType || !teamId || !action) throw new AppError("playerId, statType, teamId, action required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
    if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId) || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Player or team does not belong to this fixture", 400);
    }

    const isIncrement = action === "increment";
    const eventMinute = Math.max(0, Number(minute) || 0);

    if (statType === "goal") {
      const existing = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const goal = await prisma.goal.create({
          data: { fixtureId: fixture.id, playerId, minute: eventMinute },
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
          data: { fixtureId: fixture.id, playerId, minute: eventMinute },
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
          data: { fixtureId: fixture.id, playerId, type: cardType, minute: eventMinute },
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

export const setMatchRating = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, rating } = req.body;
    if (!playerId || rating === undefined) throw new AppError("playerId and rating required", 400);
    const value = Math.max(0, Math.min(10, Number(rating)));
    if (Number.isNaN(value)) throw new AppError("Invalid rating", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, homeTeamId: true, awayTeamId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true } });
    if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId)) {
      throw new AppError("Player does not belong to this fixture", 400);
    }

    const row = await prisma.matchPlayerRating.upsert({
      where: { fixtureId_playerId: { fixtureId: fixture.id, playerId } },
      create: { fixtureId: fixture.id, playerId, rating: value },
      update: { rating: value },
    });
    res.json(row);
  } catch (error) {
    next(error);
  }
};

export const setManOfTheMatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId } = req.body;
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, homeTeamId: true, awayTeamId: true, manOfTheMatchId: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    let nextId: string | null = null;
    if (playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true } });
      if (!player || (player.teamId !== fixture.homeTeamId && player.teamId !== fixture.awayTeamId)) {
        throw new AppError("Player does not belong to this fixture", 400);
      }
      nextId = player.id;
    }

    const updated = await prisma.fixture.update({ where: { id: fixture.id }, data: { manOfTheMatchId: nextId } });
    res.json({ manOfTheMatchId: updated.manOfTheMatchId });
  } catch (error) {
    next(error);
  }
};

// ─── Goal & Substitution Management ───

export const addGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, scorerId, assistId, minute, isOwnGoal, isPenalty } = req.body;
    if (!teamId || !scorerId) throw new AppError("teamId and scorerId required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const eventMinute = Number(minute);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const scorer = await prisma.player.findUnique({ where: { id: scorerId }, select: { teamId: true, seasonId: true, isActive: true } });
    if (!scorer || !scorer.isActive || scorer.seasonId !== fixture.seasonId || scorer.teamId !== teamId || ![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) {
      throw new AppError("Scorer does not belong to this fixture", 400);
    }
    if (assistId) {
      const assister = await prisma.player.findUnique({ where: { id: assistId }, select: { teamId: true, seasonId: true, isActive: true } });
      if (!assister || !assister.isActive || assister.seasonId !== fixture.seasonId || assister.teamId !== teamId) throw new AppError("Assister must belong to the scoring team", 400);
    }

    const goal = await prisma.goal.create({
      data: { fixtureId: fixture.id, playerId: scorerId, minute: eventMinute, isOwnGoal: !!isOwnGoal, isPenalty: !!isPenalty },
    });

    if (assistId) {
      await prisma.assist.create({
        data: { fixtureId: fixture.id, playerId: assistId, minute: eventMinute, goalId: goal.id },
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
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true, seasonId: true, homeTeamId: true, awayTeamId: true, status: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    if (![fixture.homeTeamId, fixture.awayTeamId].includes(teamId)) throw new AppError("Team is not part of this fixture", 400);
    if (["SCHEDULED", "COMPLETED", "CANCELLED", "POSTPONED"].includes(fixture.status)) throw new AppError("Substitutions can only be recorded during an active match", 400);
    const eventMinute = Number(minute);
    if (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 150) throw new AppError("Minute must be an integer between 0 and 150", 400);
    const players = await prisma.player.findMany({ where: { id: { in: [playerOffId, playerOnId] }, teamId, seasonId: fixture.seasonId, isActive: true }, select: { id: true } });
    if (players.length !== 2) throw new AppError("Both players must belong to the selected team", 400);

    const sub = await prisma.substitution.create({
      data: { fixtureId: req.params.id, playerOffId, playerOnId, minute: eventMinute },
    });
    res.status(201).json(sub);
  } catch (error) {
    next(error);
  }
};

// Generic event removal used by Undo / Delete from the live timeline.
// `type` must be one of: goal, assist, card, substitution, note.
export const removeMatchEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.body;
    if (!type || !id) throw new AppError("type and id required", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    if (type === "goal") {
      const goal = await prisma.goal.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!goal) throw new AppError("Goal not found", 404);
      // Remove the linked assist (if created with the goal) then the goal.
      await prisma.assist.deleteMany({ where: { goalId: goal.id } });
      await prisma.goal.delete({ where: { id: goal.id } });
      await recalcScore(fixture.id);
    } else if (type === "assist") {
      const event = await prisma.assist.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Assist not found for this fixture", 404);
      await prisma.assist.delete({ where: { id: event.id } });
    } else if (type === "card") {
      const event = await prisma.card.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Card not found for this fixture", 404);
      await prisma.card.delete({ where: { id: event.id } });
    } else if (type === "substitution") {
      const event = await prisma.substitution.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Substitution not found for this fixture", 404);
      await prisma.substitution.delete({ where: { id: event.id } });
    } else if (type === "note") {
      const event = await prisma.matchNote.findFirst({ where: { id, fixtureId: fixture.id } });
      if (!event) throw new AppError("Note not found for this fixture", 404);
      await prisma.matchNote.delete({ where: { id: event.id } });
    } else {
      throw new AppError("Invalid event type", 400);
    }

    res.json({ message: "Event removed" });
  } catch (error) {
    next(error);
  }
};

export const addMatchNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, playerId, type, minute, note } = req.body;
    if (!type) throw new AppError("type required", 400);
    const noteTypes = ["VAR", "MISSED_PENALTY", "INFO"];
    if (!noteTypes.includes(type)) throw new AppError("type must be VAR, MISSED_PENALTY, or INFO", 400);
    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    if (playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
      if (!player) throw new AppError("Player not found", 400);
    }

    const created = await prisma.matchNote.create({
      data: { fixtureId: fixture.id, teamId: teamId || null, playerId: playerId || null, type, minute: minute || 0, note: note || null },
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

// Update fixture-level team stats (possession, shots, corners, ...).
export const updateTeamStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statFields = [
      "homePossession", "awayPossession", "homeShots", "awayShots",
      "homeShotsOnTarget", "awayShotsOnTarget", "homeCorners", "awayCorners",
      "homeFouls", "awayFouls", "homeOffsides", "awayOffsides",
      "homeExpectedGoals", "awayExpectedGoals",
    ] as const;
    const data: any = {};
    for (const field of statFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    if (Object.keys(data).length === 0) throw new AppError("No stats to update", 400);
    const fixture = await prisma.fixture.update({ where: { id: req.params.id }, data });
    res.json(fixture);
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
  const goals = await prisma.goal.findMany({
    where: { fixtureId },
    include: { player: { select: { teamId: true } } },
  });
  let homeGoals = 0;
  let awayGoals = 0;
  for (const g of goals) {
    const scorerIsHome = g.player.teamId === fixture.homeTeamId;
    if (g.isOwnGoal) {
      // Own goals count for the opposing team.
      if (scorerIsHome) awayGoals += 1;
      else homeGoals += 1;
    } else {
      if (scorerIsHome) homeGoals += 1;
      else awayGoals += 1;
    }
  }
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
