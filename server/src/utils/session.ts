import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";
import { config } from "../config/index.js";

export const ACCESS_COOKIE = "fusion_access";
export const REFRESH_COOKIE = "fusion_refresh";
export const CSRF_COOKIE = "XSRF-TOKEN";

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const cookieBase = () => ({
  secure: config.nodeEnv === "production",
  // Render's static client and API use different sites until the documented
  // same-site ingress cutover. Cross-site cookies therefore require None;
  // mutating requests remain protected by the double-submit CSRF token.
  sameSite: (config.nodeEnv === "production" ? "none" : "lax") as "none" | "lax",
  path: "/",
});

export async function issueSession(res: Response, user: { id: string; role: string }, meta: { userAgent?: string; ipAddress?: string }) {
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, { expiresIn: "15m" });
  const refreshToken = randomBytes(48).toString("base64url");
  const csrfToken = issueCsrfToken(res);
  await prisma.refreshToken.create({ data: {
    token: hashSessionToken(refreshToken), userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: meta.userAgent?.slice(0, 500), ipAddress: meta.ipAddress?.slice(0, 100),
  } });
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), httpOnly: true, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  return { accessToken, csrfToken };
}

export function issueCsrfToken(res: Response) {
  const csrfToken = randomBytes(24).toString("base64url");
  res.cookie(CSRF_COOKIE, csrfToken, { ...cookieBase(), httpOnly: false, maxAge: 30 * 24 * 60 * 60 * 1000 });
  return csrfToken;
}

export function clearSessionCookies(res: Response) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) res.clearCookie(name, cookieBase());
}
