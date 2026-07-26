import { Router } from "express";
import {
  getSeasons, getCurrentSeason, getTeams, getTeamBySlug,
  getPlayers, getPlayerBySlug, getFixtures, getFixtureById,
  getStandings, getTopScorers, getTopAssists, getPlayerStats,
  getAwards, getAwardBySlug, voteForAward, getNews, getGallery, getSponsors,
} from "../controllers/league.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";

const router = Router();

// Seasons
router.get("/seasons", getSeasons);
router.get("/seasons/current", getCurrentSeason);

// Teams
router.get("/teams", getTeams);
router.get("/teams/:slug", getTeamBySlug);

// Players
router.get("/players", getPlayers);
router.get("/players/:slug", getPlayerBySlug);

// Fixtures
router.get("/fixtures", getFixtures);
router.get("/fixtures/:id", getFixtureById);

// Standings
router.get("/standings", getStandings);

// Statistics
router.get("/stats/top-scorers", getTopScorers);
router.get("/stats/top-assists", getTopAssists);
router.get("/stats/players", getPlayerStats);

// Awards
router.get("/awards", getAwards);
router.get("/awards/:slug", getAwardBySlug);
router.post("/awards/vote", authenticate, voteForAward);

// News
router.get("/news", getNews);

// Gallery
router.get("/gallery", getGallery);

// Sponsors
router.get("/sponsors", getSponsors);

export default router;
