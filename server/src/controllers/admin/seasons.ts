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

// Seasons, transfer windows, and season rollover


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
