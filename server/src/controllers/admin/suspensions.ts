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

// Player suspensions (cards, bans)


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
