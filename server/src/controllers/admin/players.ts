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

// Players, squads, and matchday squad selection


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
