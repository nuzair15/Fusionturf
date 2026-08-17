import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";

// Admin authentication (password-only login, bootstraps a real revocable User row)

// A plain `===` comparison on a shared secret leaks timing information
// proportional to how many leading characters matched, which an attacker
// can exploit to recover the password byte-by-byte over enough requests.
// Hashing both sides to a fixed-length digest first means
// crypto.timingSafeEqual always compares equal-length buffers (it throws on
// a length mismatch otherwise) and the comparison itself takes constant time.
function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export const loginAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.adminPanel.password) throw new AppError("Admin authentication is not configured", 503);
    const { password } = req.body || {};
    if (typeof password !== "string" || password.length === 0 || !timingSafeStringEqual(password, config.adminPanel.password)) {
      throw new AppError("Invalid admin credentials", 401);
    }

    // Resolve to a real, deactivatable User row (created once, on first use)
    // instead of minting a token for a fake user id that bypassed the
    // database lookup in the auth middleware. This means: deactivating this
    // user immediately revokes admin-panel access, and every action taken
    // through this login is attributable to a real userId in ActivityLog.
    let bootstrapAdmin = await prisma.user.findUnique({ where: { email: config.adminPanel.bootstrapEmail } });
    if (!bootstrapAdmin) {
      const randomPassword = uuidv4() + uuidv4();
      bootstrapAdmin = await prisma.user.create({
        data: {
          email: config.adminPanel.bootstrapEmail,
          passwordHash: await bcrypt.hash(randomPassword, 12),
          firstName: "Super",
          lastName: "Admin",
          role: "SUPER_ADMIN",
          isActive: true,
          emailVerified: true,
        },
      });
    } else if (!bootstrapAdmin.isActive) {
      throw new AppError("Admin account has been deactivated", 403);
    }

    const token = jwt.sign({ userId: bootstrapAdmin.id, role: bootstrapAdmin.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
    res.json({ token });
  } catch (error) {
    next(error);
  }
};

// ─── Seasons Management ───
