import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorize } from "../middleware/auth.js";
import { activityLogger } from "../middleware/activityLogger.js";
import * as admin from "../controllers/admin.js";
import * as bookingAdmin from "../controllers/booking.js";
import * as playerStats from "../controllers/playerStats.js";

const router = Router();

// Live match readers refresh repeatedly while the clock runs. Limit this
// separately by authenticated operator, rather than counting it against the
// whole site's coarse IP-based 15-minute limit.
const liveStatsReadLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || "unknown",
  message: { error: "Live match refresh limit reached. Please wait a moment." },
});

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER", "CONTENT_EDITOR", "STATISTICIAN", "REFEREE", "VIEWER"));
router.use(activityLogger);

// Dashboard
router.get("/dashboard", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.getDashboardStats);
router.get("/activity-logs", authorize("SUPER_ADMIN"), admin.getActivityLogs);
router.get("/recycle-bin", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getRecycleBin);
router.post("/recycle-bin/:type/:id/archive", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.archiveToRecycleBin);
router.get("/recycle-bin/:archiveId/dependencies", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getRecycleBinDependencies);
router.post("/recycle-bin/:archiveId/restore", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.restoreFromRecycleBin);
router.post("/recycle-bin/:type/:id/restore", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.restoreFromRecycleBin);

// Seasons
router.get("/seasons", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), admin.getSeasons);
router.post("/seasons", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createSeason);
router.patch("/seasons/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateSeason);
router.delete("/seasons/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteSeason);

// Teams
router.get("/teams", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), admin.getTeams);
router.post("/teams", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createTeam);
router.patch("/teams/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateTeam);
router.delete("/teams/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteTeam);

// Players
router.get("/players", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), admin.getPlayers);
router.get("/players/search", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), admin.searchPlayers);
router.post("/players", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.createPlayer);
router.patch("/players/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updatePlayer);
router.delete("/players/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deletePlayer);
router.get("/player-stats", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "VIEWER"), playerStats.getAdminPlayerStats);
router.patch("/player-stats/:playerId", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), playerStats.updateAdminPlayerStats);

// Fixtures
router.get("/fixtures", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), admin.getFixtures);
router.get("/fixtures/recycle-bin", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getDeletedFixtures);
router.get("/competitions", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getCompetitions);
router.get("/competitions/:id/bracket", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getCompetitionBracket);
router.post("/competitions/:id/schedule-previews", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createSchedulePreview);
router.post("/schedule-previews/:id/publish", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.publishSchedulePreview);
router.post("/competitions/:id/bracket/generate", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.generateCompetitionBracket);
router.get("/fixtures/:id/result-history", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.getFixtureResultHistory);
router.post("/fixtures", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createFixture);
router.patch("/fixtures/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixture);
router.patch("/fixtures/:id/status", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureStatus);
router.patch("/fixtures/:id/referee", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.assignFixtureReferee);
router.post("/fixtures/:id/reschedule", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.rescheduleFixture);
router.post("/fixtures/:id/settle", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.settleFixtureOutcome);
router.patch("/fixtures/:id/score", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureScore);
router.delete("/fixtures/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteFixture);
router.post("/fixtures/:id/restore", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.restoreFixture);
router.put("/fixtures/:id/lineups", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureLineups);

// Awards
router.get("/awards", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "VIEWER"), admin.getAwards);
router.post("/awards", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createAward);
router.patch("/awards/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateAward);
router.delete("/awards/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteAward);
router.patch("/awards/:id/voting", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.toggleVoting);
router.post("/awards/:id/nominations", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.addNomination);
router.post("/awards/:id/announce-winner", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.announceWinner);

// CMS
router.get("/news", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR", "VIEWER"), admin.getNews);
router.post("/news", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.createNews);
router.patch("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateNews);
router.delete("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteNews);
router.post("/gallery", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.manageGallery);
router.get("/gallery", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR", "VIEWER"), admin.getGalleryItems);
router.patch("/gallery/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateGalleryItem);
router.delete("/gallery/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteGalleryItem);

// Coupons
router.get("/coupons", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.getCoupons);
router.post("/coupons", authorize("SUPER_ADMIN"), admin.createCoupon);
router.patch("/coupons/:id", authorize("SUPER_ADMIN"), admin.updateCoupon);
router.delete("/coupons/:id", authorize("SUPER_ADMIN"), admin.deleteCoupon);

// Advertisements
router.get("/ads", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.getAdvertisements);
router.post("/ads", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.createAdvertisement);
router.patch("/ads/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.updateAdvertisement);
router.delete("/ads/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.deleteAdvertisement);

// FAQs
router.get("/faqs", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.getFaqs);
router.post("/faqs", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.createFaq);
router.patch("/faqs/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.updateFaq);
router.delete("/faqs/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.deleteFaq);

// Reviews
router.get("/reviews", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.getReviews);
router.patch("/reviews/:id/approve", authorize("SUPER_ADMIN"), admin.approveReview);
router.delete("/reviews/:id", authorize("SUPER_ADMIN"), admin.deleteReview);

// Sponsors
router.get("/sponsors", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR", "VIEWER"), admin.getSponsors);
router.patch("/sponsors/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateSponsor);
router.delete("/sponsors/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteSponsor);

// Settings
router.get("/settings", authorize("SUPER_ADMIN"), admin.getSettings);
router.patch("/settings", authorize("SUPER_ADMIN"), admin.updateSettings);

// Users
router.get("/users", authorize("SUPER_ADMIN"), admin.getUsers);
router.patch("/users/:id/role", authorize("SUPER_ADMIN"), admin.updateUserRole);

// Booking Admin
router.get("/bookings", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminGetAllBookings);
router.post("/bookings/block-date", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminBlockDate);
router.patch("/bookings/:id/status", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminUpdateBookingStatus);
router.patch("/bookings/:id/payment", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminMarkBookingPaid);
router.patch("/bookings/:id/refund", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminRefundBooking);
router.patch("/bookings/:id/discount", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminUpdateBookingDiscount);
router.patch("/bookings/:id", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminUpdateBooking);

// Venue Management
router.get("/venues", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.getVenues);
router.post("/venues", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.createVenue);
router.patch("/venues/:id", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.updateVenue);
router.delete("/venues/:id", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.deleteVenue);

// Turf Management
router.post("/turfs", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.createTurf);
router.patch("/turfs/:id", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.updateTurf);
router.delete("/turfs/:id", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), admin.deleteTurf);

// League System Operations
router.post("/seasons/:id/generate-fixtures", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.generateFixtures);
router.post("/seasons/:id/postseason", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.generatePostSeason);
router.post("/seasons/:id/transfer-window/open", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminOpenTransferWindow);
router.post("/seasons/:id/transfer-window/close", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminCloseTransferWindow);
router.post("/seasons/:id/copy-players-from/:fromSeasonId", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.copyPlayersFromSeason);
router.post("/seasons/:id/create-next", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminCreateNextSeason);
router.post("/fixtures/:id/squad", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.adminSelectMatchdaySquad);
router.get("/teams/:id/validate-squad", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.adminValidateSquad);
router.post("/process-match-result/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.adminProcessMatchResult);
router.get("/standings/adjustments", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getStandingAdjustments);
router.post("/standings/adjustments", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createStandingAdjustment);
router.delete("/standings/adjustments/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteStandingAdjustment);

// Live Match Stats
router.get("/fixtures/:id/live-stats", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), liveStatsReadLimit, admin.getLiveStats);
router.post("/fixtures/:id/live-stats/update", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateLiveStat);
router.patch("/fixtures/:id/live-stats/team", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateTeamStats);
router.post("/fixtures/:id/live-stats/reset-clock", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.resetFixtureClock);
router.post("/fixtures/:id/goal", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.addGoal);
router.post("/fixtures/:id/awarded-goal", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.addAwardedGoal);
router.patch("/fixtures/:id/goal/:goalId", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateGoal);
router.post("/fixtures/:id/goal/remove", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.removeGoal);
router.patch("/fixtures/:id/match-rating", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.setMatchRating);
router.patch("/fixtures/:id/man-of-the-match", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.setManOfTheMatch);
router.post("/fixtures/:id/substitution", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.addSubstitution);
router.post("/fixtures/:id/event/remove", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.removeMatchEvent);
router.post("/fixtures/:id/note", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.addMatchNote);
router.post("/fixtures/:id/appearance", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.recordMatchAppearance);
router.post("/fixtures/:id/shot", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.recordMatchShot);

// Global Search
router.get("/search", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER", "CONTENT_EDITOR", "STATISTICIAN", "REFEREE", "VIEWER"), admin.adminSearch);

// Suspensions
router.get("/suspensions", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"), admin.adminGetSuspensions);
router.post("/suspensions", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminCreateSuspension);
router.patch("/suspensions/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminUpdateSuspension);
router.delete("/suspensions/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminDeleteSuspension);

export default router;
