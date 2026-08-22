import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, readCookie } from "../utils/session.js";
import { sendError } from "./errorHandler.js";

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.headers.authorization) return next();
  if (["/api/auth/login", "/api/auth/register"].includes(req.path)) return next();
  if (!readCookie(req, ACCESS_COOKIE) && !readCookie(req, REFRESH_COOKIE)) return next();
  const cookie = readCookie(req, CSRF_COOKIE) || "";
  const header = req.get("X-XSRF-TOKEN") || "";
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  if (!cookie || a.length !== b.length || !timingSafeEqual(a, b)) {
    return sendError(req, res, 403, "INVALID_CSRF_TOKEN", "Invalid CSRF token");
  }
  next();
}
