import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { clearSessionCookies, hashSessionToken, issueCsrfToken, issueSession, readCookie, REFRESH_COOKIE } from "../utils/session.js";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { decryptMfaSecret, encryptMfaSecret, generateMfaSecret, otpAuthUri, verifyTotp } from "../utils/mfa.js";

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    otp: z.string().regex(/^\d{6}$/).optional(),
  }),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone } = registerSchema.parse(req).body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone, role: "CUSTOMER" },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    const { csrfToken } = await issueSession(res, user, { userAgent: req.get("user-agent"), ipAddress: req.ip });

    res.status(201).json({ user, csrfToken });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, otp } = loginSchema.parse(req).body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError("Invalid credentials", 401);
    }

    if (!user.isActive) {
      throw new AppError("Account is deactivated", 403);
    }

    if (user.role !== "CUSTOMER") {
      if (!user.mfaEnabled || !user.mfaSecret) {
        const setupToken = jwt.sign({ userId: user.id, purpose: "mfa_setup" }, config.jwt.secret, { expiresIn: "10m" });
        res.json({ mfaSetupRequired: true, setupToken });
        return;
      }
      if (!otp) {
        res.json({ mfaRequired: true });
        return;
      }
      if (!verifyTotp(decryptMfaSecret(user.mfaSecret), otp)) throw new AppError("Invalid authentication code", 401, "INVALID_MFA_CODE");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { csrfToken } = await issueSession(res, user, { userAgent: req.get("user-agent"), ipAddress: req.ip });

    const { passwordHash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, csrfToken });
  } catch (error) {
    next(error);
  }
};

function mfaSetupUserId(token: unknown) {
  if (typeof token !== "string" || !token) throw new AppError("MFA setup token is required", 401);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as { userId?: string; purpose?: string };
    if (!payload.userId || payload.purpose !== "mfa_setup") throw new Error("invalid scope");
    return payload.userId;
  } catch {
    throw new AppError("MFA setup token is invalid or expired", 401);
  }
}

export const beginMfaSetup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = mfaSetupUserId(req.body?.setupToken);
    const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, email: true, role: true } });
    if (!user || user.role === "CUSTOMER") throw new AppError("MFA enrollment is not available for this account", 403);
    const secret = generateMfaSecret();
    await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: encryptMfaSecret(secret), mfaEnabled: false, mfaEnrolledAt: null } });
    res.json({ secret, otpAuthUri: otpAuthUri(user.email, secret) });
  } catch (error) { next(error); }
};

export const confirmMfaSetup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = mfaSetupUserId(req.body?.setupToken);
    const otp = typeof req.body?.otp === "string" ? req.body.otp : "";
    const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, mfaSecret: true } });
    if (!user?.mfaSecret) throw new AppError("Begin MFA setup first", 409);
    if (!verifyTotp(decryptMfaSecret(user.mfaSecret), otp)) throw new AppError("Invalid authentication code", 400, "INVALID_MFA_CODE");
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaEnrolledAt: new Date() } });
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.json({ enrolled: true });
  } catch (error) { next(error); }
};

export const refreshSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (!raw) throw new AppError("Refresh session required", 401);
    const session = await prisma.refreshToken.findUnique({
      where: { token: hashSessionToken(raw) },
      include: { user: { select: { id: true, role: true, isActive: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      clearSessionCookies(res);
      throw new AppError("Session is expired or revoked", 401);
    }
    await prisma.refreshToken.update({ where: { id: session.id }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
    const { csrfToken } = await issueSession(res, session.user, { userAgent: req.get("user-agent"), ipAddress: req.ip });
    res.json({ refreshed: true, csrfToken });
  } catch (error) { next(error); }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (raw) await prisma.refreshToken.updateMany({ where: { token: hashSessionToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
    clearSessionCookies(res);
    res.status(204).send();
  } catch (error) { next(error); }
};

export const revokeAllSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.refreshToken.updateMany({ where: { userId: req.user!.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    clearSessionCookies(res);
    res.status(204).send();
  } catch (error) { next(error); }
};

export const getSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: req.user!.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, lastUsedAt: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: sessions });
  } catch (error) { next(error); }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatarUrl: true, role: true, isActive: true,
        emailVerified: true, mfaEnabled: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new AppError("User not found", 404);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const getCsrfToken = async (_req: Request, res: Response) => {
  res.json({ csrfToken: issueCsrfToken(res) });
};
