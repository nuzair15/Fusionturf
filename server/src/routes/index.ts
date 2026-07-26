import { Router } from "express";
import authRoutes from "./auth";
import bookingRoutes from "./booking";
import leagueRoutes from "./league";
import adminRoutes from "./admin";

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
