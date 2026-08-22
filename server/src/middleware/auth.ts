import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import prisma from "../config/database.js";
import { ACCESS_COOKIE, readCookie } from "../utils/session.js";
import { sendError } from "./errorHandler.js";

export interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = readCookie(req, ACCESS_COOKIE);
    if ((!authHeader || !authHeader.startsWith("Bearer ")) && !cookieToken) {
      return sendError(req, res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }

    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : cookieToken!;

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Every token — including tokens issued by the admin-panel password login —
    // must correspond to a real, active user row. There is no bypass: this is
    // what lets an admin account be deactivated/revoked and keeps activity
    // logging attributable to a real user id.
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return sendError(req, res, 401, "SESSION_USER_INACTIVE", "User not found or inactive");
    }

    // Trust the role currently stored on the user record rather than the
    // (potentially stale, up to 7 days old) role embedded in the JWT, so a
    // role change/demotion or deactivation takes effect immediately instead
    // of waiting for the token to expire.
    req.user = { userId: user.id, role: user.role };
    next();
  } catch (error) {
    return sendError(req, res, 401, "INVALID_SESSION", "Invalid or expired token");
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(req, res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      return sendError(req, res, 403, "INSUFFICIENT_PERMISSIONS", "Insufficient permissions");
    }
    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = readCookie(req, ACCESS_COOKIE);
    if ((authHeader && authHeader.startsWith("Bearer ")) || cookieToken) {
      const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : cookieToken!;
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      // Optional authentication is anonymous only when no valid session is
      // supplied. Never promote a request from claims in an old JWT: roles and
      // active state are revocable server-side.
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (user?.isActive) req.user = { userId: user.id, role: user.role };
    }
  } catch {
    // This middleware intentionally leaves invalid optional credentials
    // anonymous. Routes which require a session use `authenticate` instead.
  }
  next();
};
