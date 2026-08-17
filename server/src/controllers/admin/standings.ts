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

// Manual standings adjustments (point deductions, corrections)


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
