import { Router } from "express";
import { getFixtures } from "../controllers/league.js";
import { createBooking, getBookingQuote } from "../controllers/booking.js";
import {
  archiveToRecycleBin,
  createSchedulePreview,
  getRecycleBin,
  getRecycleBinDependencies,
  publishSchedulePreview,
  restoreFromRecycleBin,
} from "../controllers/admin.js";
import { authenticate, authorize, optionalAuth } from "../middleware/auth.js";
import { streamFixtureEvents } from "../controllers/events.js";

const router = Router();

router.get("/fixtures", getFixtures);
router.get("/fixtures/:id/events/stream", streamFixtureEvents);
router.post("/booking/quote", getBookingQuote);
router.post("/bookings", optionalAuth, (req, res, next) => {
  if (!req.header("Idempotency-Key")?.trim()) return res.status(400).json({ code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key header is required" });
  return createBooking(req, res, next);
});

router.post("/competitions/:id/schedule-previews", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), createSchedulePreview);
router.post("/schedule-previews/:id/publish", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), publishSchedulePreview);

router.get("/admin/recycle-bin", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), getRecycleBin);
router.post("/admin/recycle-bin/:type/:id/archive", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), archiveToRecycleBin);
router.get("/admin/recycle-bin/:archiveId/dependencies", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), getRecycleBinDependencies);
router.post("/admin/recycle-bin/:archiveId/restore", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), restoreFromRecycleBin);

export default router;
