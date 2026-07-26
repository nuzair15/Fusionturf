import { Router } from "express";
import authRoutes from "./auth.js";
import bookingRoutes from "./booking.js";
import leagueRoutes from "./league.js";
import adminRoutes from "./admin.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/bookings", bookingRoutes);
router.use("/league", leagueRoutes);
router.use("/admin", adminRoutes);

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
