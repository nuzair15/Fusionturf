import { Router } from "express";
import authRoutes from "./auth.js";
import bookingRoutes from "./booking.js";
import leagueRoutes from "./league.js";
import adminRoutes from "./admin.js";
import * as adminController from "../controllers/admin.js";
import v2Routes from "./v2.js";
import prisma from "../config/database.js";

const router = Router();

router.use("/v2", v2Routes);

router.use("/auth", authRoutes);
router.use("/bookings", bookingRoutes);
router.use("/league", leagueRoutes);

// Public settings endpoint (no auth required)
router.get("/settings", adminController.getPublicSettings);
router.post("/admin/login", (_req, res) => res.status(410).json({
  code: "ADMIN_SHARED_LOGIN_RETIRED",
  message: "Shared admin login has been retired. Use /api/auth/login with an individual staff account.",
  requestId: res.locals.requestId,
}));

router.use("/admin", adminRoutes);

// Health check
router.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const failed = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
        AND finished_at IS NULL
    `;
    const failedMigrations = Number(failed[0]?.count || 0);
    if (failedMigrations > 0) {
      return res.status(503).json({ status: "not_ready", database: "ok", migrations: "failed" });
    }
    return res.json({ status: "ok", database: "ok", migrations: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return res.status(503).json({ status: "not_ready", database: "unavailable", migrations: "unknown" });
  }
});

export default router;
