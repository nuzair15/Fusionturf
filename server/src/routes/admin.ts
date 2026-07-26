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
router.post("/seasons", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createSeason);
router.patch("/seasons/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateSeason);

// Teams
router.post("/teams", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createTeam);
router.patch("/teams/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateTeam);

// Players
router.post("/players", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.createPlayer);
router.patch("/players/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updatePlayer);

// Fixtures
router.post("/fixtures", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createFixture);
router.patch("/fixtures/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixture);
router.patch("/fixtures/:id/score", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN"), admin.updateFixtureScore);

// Awards
router.post("/awards", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.createAward);
router.patch("/awards/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.updateAward);
router.patch("/awards/:id/voting", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.toggleVoting);
router.post("/awards/:id/nominations", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.addNomination);
router.post("/awards/:id/announce-winner", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.announceWinner);

// CMS
router.post("/news", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.createNews);
router.patch("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateNews);
router.delete("/news/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteNews);
router.post("/gallery", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.manageGallery);
router.delete("/gallery/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.deleteGalleryItem);
router.post("/sponsors", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.manageSponsor);
router.patch("/sponsors/:id", authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), admin.updateSponsor);

// Settings
router.get("/settings", admin.getSettings);
router.patch("/settings", authorize("SUPER_ADMIN"), admin.updateSettings);

// Users
router.get("/users", authorize("SUPER_ADMIN", "LEAGUE_ADMIN"), admin.getUsers);
router.patch("/users/:id/role", authorize("SUPER_ADMIN"), admin.updateUserRole);

// Booking Admin
router.get("/bookings", bookingAdmin.adminGetAllBookings);
router.post("/bookings/block-date", authorize("SUPER_ADMIN", "BOOKING_MANAGER"), bookingAdmin.adminBlockDate);

export default router;
