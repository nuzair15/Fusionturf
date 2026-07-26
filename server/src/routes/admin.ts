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

// Teams
router.get("/teams", admin.getTeams);
router.post("/teams", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createTeam);
router.patch("/teams/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateTeam);

// Players
router.get("/players", admin.getPlayers);
router.post("/players", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.createPlayer);
router.patch("/players/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updatePlayer);

// Fixtures
router.get("/fixtures", admin.getFixtures);
router.post("/fixtures", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createFixture);
router.patch("/fixtures/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixture);
router.patch("/fixtures/:id/score", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureScore);

// Awards
router.get("/awards", admin.getAwards);
router.post("/awards", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createAward);
router.patch("/awards/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateAward);
router.patch("/awards/:id/voting", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.toggleVoting);
router.post("/awards/:id/nominations", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.addNomination);
router.post("/awards/:id/announce-winner", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.announceWinner);

// CMS
router.get("/news", admin.getNews);
router.post("/news", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.createNews);
router.patch("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateNews);
router.delete("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteNews);
router.post("/gallery", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.manageGallery);
router.delete("/gallery/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteGalleryItem);
router.post("/sponsors", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.manageSponsor);
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
router.post("/seasons/:id/create-next", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminCreateNextSeason);
router.post("/fixtures/:id/squad", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.adminSelectMatchdaySquad);
router.get("/teams/:id/validate-squad", admin.adminValidateSquad);
router.post("/process-match-result/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.adminProcessMatchResult);

// Live Match Stats
router.get("/fixtures/:id/live-stats", admin.getLiveStats);
router.post("/fixtures/:id/live-stats/update", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateLiveStat);

// Suspensions
router.get("/suspensions", admin.adminGetSuspensions);
router.post("/suspensions", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminCreateSuspension);
router.patch("/suspensions/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminUpdateSuspension);
router.delete("/suspensions/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.adminDeleteSuspension);

export default router;
