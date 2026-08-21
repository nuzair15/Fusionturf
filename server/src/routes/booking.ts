import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getVenues, getVenueBySlug, getAvailableSlots, getBookedSlotsForTurf, validateCoupon, createBooking,
  getMyBookings, cancelBooking,
  adminGetAllBookings, adminBlockDate, adminRevenueAnalytics, getCalendarBookings,
} from "../controllers/booking.js";
import { authenticate, authorize, optionalAuth } from "../middleware/auth.js";

const router = Router();

// A double-booking race is easiest to trigger, and a guest-checkout account
// is easiest to squat on, via a scripted burst of POSTs to this one route —
// so it gets a tighter limit than the general API traffic.
const createBookingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many booking attempts, please slow down" },
});

// Public
router.get("/venues", getVenues);
router.get("/venues/:slug", getVenueBySlug);
router.get("/slots", getAvailableSlots);
router.get("/booked-slots/:turfId", getBookedSlotsForTurf);
router.post("/validate-coupon", validateCoupon);
router.post("/", createBookingRateLimit, optionalAuth, createBooking);
router.get("/my", authenticate, getMyBookings);
router.patch("/:id/cancel", authenticate, cancelBooking);

// Admin
router.get("/admin", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER", "LEAGUE_ADMIN"), adminGetAllBookings);
router.post("/block-date", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER"), adminBlockDate);
router.get("/analytics/revenue", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER"), adminRevenueAnalytics);
router.get("/calendar", authenticate, authorize("SUPER_ADMIN", "BOOKING_MANAGER"), getCalendarBookings);

export default router;
