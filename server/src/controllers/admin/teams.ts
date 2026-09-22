import { ensureClub, lockSeason } from "../../services/season-identity.js";
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

// Teams management

function bannerUrl(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048 || !/^(https?:\/\/|\/(?!\/))/i.test(value)) throw new AppError("Hero banner must be an uploaded image URL", 400);
  return value;
}

export const getTeams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, search } = req.query;
    const where: any = { deletedAt: null };
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
    const coverUrl = req.body.coverUrl === undefined ? null : bannerUrl(req.body.coverUrl);
    if (!name || !seasonId) throw new AppError("name and seasonId are required", 400);
    const baseSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    let teamSlug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.team.findFirst({ where: { seasonId, slug: teamSlug } });
      if (!existing) break;
      teamSlug = `${baseSlug}-${attempt + 2}`;
    }
    const team = await prisma.$transaction(async tx => {
      await lockSeason(tx, seasonId);
      const created = await tx.team.create({
      data: {
        name, slug: teamSlug, shortName: shortName || null, logoUrl: logoUrl || null, coverUrl,
        city: city || null, seasonId, status: status || "active", isActive: status !== "inactive",
      },
    });
      await ensureClub(tx, created.id);
      return tx.team.findUniqueOrThrow({ where: { id: created.id } });
    }, { isolationLevel: "Serializable" });
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
    const data = pick(req.body, ["name", "slug", "shortName", "logoUrl", "coverUrl", "city", "seasonId", "status"] as const) as any;
    if (data.coverUrl !== undefined) data.coverUrl = bannerUrl(data.coverUrl);
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const current = await prisma.team.findUnique({ where: { id: req.params.id }, select: { seasonId: true } });
    if (!current) throw new AppError("Team not found", 404);
    if (data.seasonId && data.seasonId !== current.seasonId) throw new AppError("Register the club in the new season instead of moving this team", 400);
    if (data.seasonId) {
      const season = await prisma.season.findUnique({ where: { id: data.seasonId }, select: { id: true } });
      if (!season) throw new AppError("Season not found", 404);
    }
    if (status !== undefined) data.isActive = status !== "inactive";
    try {
      const team = await prisma.$transaction(async tx => {
        await lockSeason(tx, current.seasonId);
        const clubId = await ensureClub(tx, req.params.id);
        const updated = await tx.team.update({ where: { id: req.params.id }, data });
        const clubData = pick(data, ["name", "shortName", "logoUrl", "coverUrl", "city"] as const);
        if (Object.keys(clubData).length) await tx.club.update({ where: { id: clubId }, data: clubData });
        await tx.seasonClub.updateMany({ where: { teamId: updated.id }, data: { status: updated.isActive ? "ACTIVE" : "INACTIVE" } });
        return updated;
      }, { isolationLevel: "Serializable" });
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
    const team = await archiveResource({ type: "team", id: req.params.id, actorId: req.user?.userId, reason: req.body?.reason });
    await leagueSystem.recalculateStandings(existing.seasonId);
    res.json(team);
  } catch (error) {
    next(error);
  }
};
