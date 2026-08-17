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

// Season awards, nominations, and winner announcements


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
