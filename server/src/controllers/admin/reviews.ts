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

// Venue review moderation


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
