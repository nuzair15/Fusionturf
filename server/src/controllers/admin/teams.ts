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

// Teams management


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
