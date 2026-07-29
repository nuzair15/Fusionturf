import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as admin from "../controllers/admin.js";
import * as bookingAdmin from "../controllers/booking.js";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER", "CONTENT_EDITOR"));

// Dashboard
router.get("/dashboard", admin.getDashboardStats);
router.get("/activity-logs", admin.getActivityLogs);

// Seasons
router.get("/seasons", admin.getSeasons);
router.post("/seasons", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createSeason);
router.patch("/seasons/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateSeason);
router.delete("/seasons/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteSeason);

// Teams
router.get("/teams", admin.getTeams);
router.post("/teams", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createTeam);
router.patch("/teams/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateTeam);
router.delete("/teams/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteTeam);

// Players
router.get("/players", admin.getPlayers);
router.get("/players/search", admin.searchPlayers);
router.post("/players", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.createPlayer);
router.patch("/players/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updatePlayer);
router.delete("/players/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deletePlayer);

// Fixtures
router.get("/fixtures", admin.getFixtures);
router.post("/fixtures", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createFixture);
router.patch("/fixtures/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixture);
router.patch("/fixtures/:id/status", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureStatus);
router.patch("/fixtures/:id/score", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureScore);
router.delete("/fixtures/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteFixture);

// Awards
router.get("/awards", admin.getAwards);
router.post("/awards", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createAward);
router.patch("/awards/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateAward);
router.delete("/awards/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.deleteAward);
router.patch("/awards/:id/voting", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.toggleVoting);
router.post("/awards/:id/nominations", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.addNomination);
router.post("/awards/:id/announce-winner", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.announceWinner);

// CMS
router.get("/news", admin.getNews);
router.post("/news", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.createNews);
router.patch("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateNews);
router.delete("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteNews);
router.post("/gallery", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.manageGallery);
router.get("/gallery", admin.getGalleryItems);
router.patch("/gallery/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateGalleryItem);
router.delete("/gallery/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteGalleryItem);

// Coupons
router.get("/coupons", admin.getCoupons);
router.post("/coupons", authorize("SUPER_ADMIN"), admin.createCoupon);
router.patch("/coupons/:id", authorize("SUPER_ADMIN"), admin.updateCoupon);
router.delete("/coupons/:id", authorize("SUPER_ADMIN"), admin.deleteCoupon);

// Advertisements
router.get("/ads", admin.getAdvertisements);
router.post("/ads", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.createAdvertisement);
router.patch("/ads/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.updateAdvertisement);
router.delete("/ads/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.deleteAdvertisement);

// FAQs
router.get("/faqs", admin.getFaqs);
router.post("/faqs", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.createFaq);
router.patch("/faqs/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.updateFaq);
router.delete("/faqs/:id", authorize("SUPER_ADMIN", "CONTENT_EDITOR"), admin.deleteFaq);

// Reviews
router.get("/reviews", admin.getReviews);
router.patch("/reviews/:id/approve", authorize("SUPER_ADMIN"), admin.approveReview);
router.delete("/reviews/:id", authorize("SUPER_ADMIN"), admin.deleteReview);

// Sponsors
router.get("/sponsors", admin.getSponsors);
router.patch("/sponsors/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateSponsor);
router.delete("/sponsors/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteSponsor);

// Settings
router.get("/settings", admin.getSettings);
router.patch("/settings", authorize("SUPER_ADMIN"), admin.updateSettings);

// Users
router.get("/users", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getUsers);
router.patch("/users/:id/role", authorize("SUPER_ADMIN"), admin.updateUserRole);

// Booking Admin
router.get("/bookings", bookingAdmin.adminGetAllBookings);
router.post("/bookings/block-date", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminBlockDate);
router.patch("/bookings/:id/status", authorize("SUPER_ADMIN", "BOOKING_MANAGER", "LEAGUE_ADMIN"), bookingAdmin.adminUpdateBookingStatus);

// Venue Management
router.get("/venues", admin.getVenues);
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
router.get("/teams/:id/validate-squad", admin.adminValidateSquad);
router.post("/process-match-result/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.adminProcessMatchResult);

// Live Match Stats
router.get("/fixtures/:id/live-stats", admin.getLiveStats);
router.post("/fixtures/:id/live-stats/update", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateLiveStat);
router.post("/fixtures/:id/goal", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.addGoal);
router.post("/fixtures/:id/goal/remove", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.removeGoal);
router.post("/fixtures/:id/substitution", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.addSubstitution);

// Suspensions
router.get("/suspensions", admin.adminGetSuspensions);
router.post("/suspensions", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminCreateSuspension);
router.patch("/suspensions/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminUpdateSuspension);
router.delete("/suspensions/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminDeleteSuspension);

export default router;
