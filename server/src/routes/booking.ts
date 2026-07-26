import { Router } from "express";
import {
  getVenues, getVenueBySlug, getAvailableSlots, getBookedSlotsForTurf, createBooking,
  getMyBookings, cancelBooking,
  adminGetAllBookings, adminBlockDate, adminRevenueAnalytics,
} from "../controllers/booking.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Public
router.get("/venues", getVenues);
router.get("/venues/:slug", getVenueBySlug);
router.get("/slots", getAvailableSlots);
router.get("/booked-slots/:turfId", getBookedSlotsForTurf);
router.post("/", createBooking);
router.get("/my", authenticate, getMyBookings);
router.patch("/:id/cancel", authenticate, cancelBooking);

// Admin
router.get("/admin", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER", "LEAGUE_ADMIN"), adminGetAllBookings);
router.post("/block-date", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER"), adminBlockDate);
router.get("/analytics/revenue", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER"), adminRevenueAnalytics);

export default router;
