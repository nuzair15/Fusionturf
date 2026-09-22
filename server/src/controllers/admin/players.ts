import { registerPlayer, updateRosterPlayer } from "../../services/player-roster.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";
import { archiveResource } from "../../services/archive.js";

// Players, squads, and matchday squad selection


export const getPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const { teamId, seasonId, search } = req.query;
    const where: any = { deletedAt: null, ...(req.query.status === "all" || req.query.includeInactive === "true" ? {} : { isActive: req.query.status !== "inactive" }) };
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
  try { res.status(201).json(await registerPlayer(req.body)); } catch (error) { next(error); }
};
export const updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await updateRosterPlayer(req.params.id, req.body, req.user?.userId)); } catch (error) { next(error); }
};
export const getPlayerDirectory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "").trim();
    res.json(await prisma.playerProfile.findMany({ where: { deletedAt: null, ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: { firstName: "asc" }, take: 50 }));
  } catch (error) { next(error); }
};
export const deletePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.player.findUnique({ where: { id: req.params.id }, select: { id: true, isActive: true } });
    if (!existing) throw new AppError("Player not found", 404);
    const player = await archiveResource({ type: "player", id: req.params.id, actorId: req.user?.userId, reason: req.body?.reason });
    res.json(player);
  } catch (error) {
    next(error);
  }
};

export const copyPlayersFromSeason = async (_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError("Use Prepare Next Season or register a returning player from the player directory. Bulk copying into an existing season is disabled to prevent duplicates.", 409));
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
