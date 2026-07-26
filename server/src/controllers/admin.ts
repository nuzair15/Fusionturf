import { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginate, paginatedResponse } from "../utils/helpers.js";
import * as leagueSystem from "../services/league-system.js";

// ─── Seasons Management ───

export const getSeasons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { teams: true, players: true, fixtures: true } } },
    });
    res.json(seasons);
  } catch (error) {
    next(error);
  }
};

export const createSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, startDate, endDate, isActive, isCurrent } = req.body;
    if (!name || !slug || !startDate || !endDate) {
      throw new AppError("name, slug, startDate, endDate are required", 400);
    }
    const data = { name, slug, startDate: new Date(startDate), endDate: new Date(endDate), isActive: !!isActive, isCurrent: !!isCurrent };
    console.log("createSeason data:", JSON.stringify(data));
    const season = await prisma.season.create({ data });
    res.status(201).json(season);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("createSeason error:", msg, error instanceof Error ? error.stack : "");
    return res.status(500).json({ error: msg });
  }
};

export const updateSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await prisma.season.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(season);
  } catch (error) {
    next(error);
  }
};

// ─── Teams Management ───

export const getTeams = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { players: true, homeMatches: true } } },
    });
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId === "admin-panel" ? undefined : req.user!.userId;
    const team = await prisma.team.create({
      data: { ...req.body, ...(userId ? { managedById: userId } : {}) },
    });
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(team);
  } catch (error) {
    next(error);
  }
};

// ─── Players Management ───

export const getPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      prisma.player.findMany({
        include: { team: { select: { name: true, slug: true } } },
        skip, take: limit,
        orderBy: { firstName: "asc" },
      }),
      prisma.player.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createPlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await prisma.player.create({ data: req.body });
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
};

export const updatePlayer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await prisma.player.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(player);
  } catch (error) {
    next(error);
  }
};

// ─── Fixtures Management ───

export const getFixtures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      prisma.fixture.findMany({
        include: { homeTeam: { select: { name: true, slug: true, logoUrl: true } }, awayTeam: { select: { name: true, slug: true, logoUrl: true } }, season: { select: { name: true } } },
        skip, take: limit,
        orderBy: { matchDate: "desc" },
      }),
      prisma.fixture.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.create({ data: req.body });
    res.status(201).json(fixture);
  } catch (error) {
    next(error);
  }
};

export const updateFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

export const updateFixtureScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeScore, awayScore } = req.body;
    const fixture = await prisma.fixture.update({
      where: { id: req.params.id },
      data: {
        homeScore,
        awayScore,
        status: "COMPLETED",
      },
    });

    // Update standings
    const stats = calculateMatchStats(homeScore, awayScore);
    await updateStanding(fixture.seasonId, fixture.homeTeamId, homeScore, awayScore, stats.home);
    await updateStanding(fixture.seasonId, fixture.awayTeamId, awayScore, homeScore, stats.away);

    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

async function updateStanding(seasonId: string, teamId: string, goalsFor: number, goalsAgainst: number, result: string) {
  const standing = await prisma.standing.findUnique({
    where: { seasonId_teamId: { seasonId, teamId } },
  });

  const updates = {
    played: (standing?.played || 0) + 1,
    goalsFor: (standing?.goalsFor || 0) + goalsFor,
    goalsAgainst: (standing?.goalsAgainst || 0) + goalsAgainst,
    goalDifference: ((standing?.goalsFor || 0) + goalsFor) - ((standing?.goalsAgainst || 0) + goalsAgainst),
    form: ((standing?.form || "") + result).slice(-5),
  };

  if (result === "W") {
    Object.assign(updates, { wins: (standing?.wins || 0) + 1, points: (standing?.points || 0) + 3 });
  } else if (result === "D") {
    Object.assign(updates, { draws: (standing?.draws || 0) + 1, points: (standing?.points || 0) + 1 });
  } else {
    Object.assign(updates, { losses: (standing?.losses || 0) + 1 });
  }

  await prisma.standing.upsert({
    where: { seasonId_teamId: { seasonId, teamId } },
    create: { seasonId, teamId, ...updates, position: 0 },
    update: updates,
  });

  // Recalculate positions
  const standings = await prisma.standing.findMany({
    where: { seasonId },
    orderBy: [{ points: "desc" }, { goalDifference: "desc" }, { goalsFor: "desc" }],
  });
  for (let i = 0; i < standings.length; i++) {
    await prisma.standing.update({
      where: { id: standings[i].id },
      data: { position: i + 1 },
    });
  }
}

function calculateMatchStats(homeScore: number, awayScore: number) {
  const home = homeScore > awayScore ? "W" : homeScore < awayScore ? "L" : "D";
  const away = awayScore > homeScore ? "W" : awayScore < homeScore ? "L" : "D";
  return { home, away };
}

// ─── Awards Management ───

export const getAwards = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const awards = await prisma.award.findMany({
      include: { winner: { select: { firstName: true, lastName: true, photoUrl: true } }, _count: { select: { votes: true, nominations: true } } },
      orderBy: { name: "asc" },
    });
    res.json(awards);
  } catch (error) {
    next(error);
  }
};

export const createAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId === "admin-panel" ? undefined : req.user!.userId;
    const award = await prisma.award.create({
      data: { ...req.body, ...(userId ? { managedById: userId } : {}) },
    });
    res.status(201).json(award);
  } catch (error) {
    next(error);
  }
};

export const updateAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const award = await prisma.award.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(award);
  } catch (error) {
    next(error);
  }
};

export const toggleVoting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const award = await prisma.award.update({
      where: { id: req.params.id },
      data: { votingEnabled: req.body.enabled },
    });
    res.json(award);
  } catch (error) {
    next(error);
  }
};

export const addNomination = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nomination = await prisma.awardNomination.create({ data: req.body });
    res.status(201).json(nomination);
  } catch (error) {
    next(error);
  }
};

export const announceWinner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, seasonId } = req.body;
    const award = await prisma.award.update({
      where: { id: req.params.id },
      data: {
        winnerId: playerId,
        winnerAnnounced: true,
        previousWinners: {
          create: {
            playerId,
            seasonId,
            year: new Date().getFullYear().toString(),
          },
        },
      },
    });
    res.json(award);
  } catch (error) {
    next(error);
  }
};

// ─── CMS ───

export const getNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      prisma.news.findMany({
        include: { team: { select: { name: true, slug: true } } },
        skip, take: limit,
        orderBy: { publishedAt: "desc" },
      }),
      prisma.news.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const createNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const news = await prisma.news.create({ data: req.body });
    res.status(201).json(news);
  } catch (error) {
    next(error);
  }
};

export const updateNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const news = await prisma.news.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(news);
  } catch (error) {
    next(error);
  }
};

export const deleteNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const manageGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.gallery.create({ data: req.body });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteGalleryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const manageSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsor = await prisma.sponsor.create({ data: req.body });
    res.status(201).json(sponsor);
  } catch (error) {
    next(error);
  }
};

export const updateSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsor = await prisma.sponsor.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(sponsor);
  } catch (error) {
    next(error);
  }
};

export const getSponsors = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsors = await prisma.sponsor.findMany({ orderBy: { tier: "asc" } });
    res.json({ data: sponsors });
  } catch (error) {
    next(error);
  }
};

export const deleteSponsor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.sponsor.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json(map);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = Object.entries(req.body).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    );
    await Promise.all(updates);
    res.json({ message: "Settings updated" });
  } catch (error) {
    next(error);
  }
};

// ─── Users Management ───

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = {};
    if (req.query.role) where.role = req.query.role;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// ─── Dashboard Analytics ───

export const getDashboardStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers, totalBookings, totalTeams, totalPlayers,
      totalFixtures, totalRevenue, activeBookings, recentFixtures,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.fixture.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.fixture.findMany({
        take: 5,
        orderBy: { matchDate: "desc" },
        include: { homeTeam: true, awayTeam: true },
      }),
    ]);

    res.json({
      stats: {
        totalUsers, totalBookings, totalTeams, totalPlayers,
        totalFixtures, totalRevenue: totalRevenue._sum.amount || 0,
        activeBookings,
      },
      recentFixtures,
    });
  } catch (error) {
    next(error);
  }
};

export const getActivityLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        include: { user: { select: { firstName: true, lastName: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

// ─── Venue Management ───

export const getVenues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venues = await prisma.venue.findMany({
      include: { turfs: { where: { isActive: true } }, _count: { select: { turfs: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ data: venues });
  } catch (error) {
    next(error);
  }
};

export const createVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venue = await prisma.venue.create({ data: req.body });
    res.status(201).json(venue);
  } catch (error) {
    next(error);
  }
};

export const updateVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venue = await prisma.venue.update({ where: { id: req.params.id }, data: req.body });
    res.json(venue);
  } catch (error) {
    next(error);
  }
};

export const deleteVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.venue.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── Turf Management ───

export const createTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const turf = await prisma.turf.create({ data: req.body });
    res.status(201).json(turf);
  } catch (error) {
    next(error);
  }
};

export const updateTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const turf = await prisma.turf.update({ where: { id: req.params.id }, data: req.body });
    res.json(turf);
  } catch (error) {
    next(error);
  }
};

export const deleteTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.turf.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── League System Operations ───

export const generateFixtures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leagueSystem.generateSeasonFixtures(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const generatePostSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await leagueSystem.generatePostSeasonFixtures(req.params.id);
    res.json({ message: "Post-season fixtures created" });
  } catch (error) {
    next(error);
  }
};

export const adminOpenTransferWindow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    await leagueSystem.openTransferWindow(req.params.id, days);
    res.json({ message: `Transfer window opened for ${days} days` });
  } catch (error) {
    next(error);
  }
};

export const adminCloseTransferWindow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await leagueSystem.closeTransferWindow(req.params.id);
    res.json({ message: "Transfer window closed" });
  } catch (error) {
    next(error);
  }
};

export const adminCreateNextSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) throw new AppError("name, startDate, endDate required", 400);
    const newSeasonId = await leagueSystem.createNextSeason(req.params.id, name, new Date(startDate), new Date(endDate));
    res.status(201).json({ id: newSeasonId });
  } catch (error) {
    next(error);
  }
};

export const adminSelectMatchdaySquad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId, playerIds } = req.body;
    if (!teamId || !playerIds) throw new AppError("teamId and playerIds required", 400);
    await leagueSystem.selectMatchdaySquad(req.params.id, teamId, playerIds);
    res.json({ message: "Matchday squad selected" });
  } catch (error) {
    next(error);
  }
};

export const adminValidateSquad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId } = req.query;
    if (!seasonId) throw new AppError("seasonId query param required", 400);
    const result = await leagueSystem.validateSquad(req.params.id, seasonId as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adminProcessMatchResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { homeScore, awayScore } = req.body;
    if (homeScore === undefined || awayScore === undefined) throw new AppError("homeScore and awayScore required", 400);
    await leagueSystem.processMatchResult(req.params.id, homeScore, awayScore);
    res.json({ message: "Match result processed" });
  } catch (error) {
    next(error);
  }
};

// ─── Live Match Stats ───

export const getLiveStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const homePlayers = await prisma.player.findMany({
      where: { teamId: fixture.homeTeamId, seasonId: fixture.seasonId, isActive: true },
      include: {
        homeStats: { where: { seasonId: fixture.seasonId } },
        cards: { where: { fixtureId: fixture.id } },
      },
      orderBy: { jerseyNumber: "asc" },
    });

    const awayPlayers = await prisma.player.findMany({
      where: { teamId: fixture.awayTeamId, seasonId: fixture.seasonId, isActive: true },
      include: {
        homeStats: { where: { seasonId: fixture.seasonId } },
        cards: { where: { fixtureId: fixture.id } },
      },
      orderBy: { jerseyNumber: "asc" },
    });

    const goals = await prisma.goal.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });
    const assists = await prisma.assist.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });
    const cards = await prisma.card.findMany({ where: { fixtureId: fixture.id }, include: { player: { select: { id: true, firstName: true, lastName: true } } } });

    const formatPlayer = (p: any) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: p.jerseyNumber,
      position: p.position,
      photoUrl: p.photoUrl,
      squadType: p.squadType,
      stats: {
        goals: goals.filter((g: any) => g.playerId === p.id).length,
        assists: assists.filter((a: any) => a.playerId === p.id).length,
        yellowCards: cards.filter((c: any) => c.playerId === p.id && c.type === "YELLOW").length,
        redCards: cards.filter((c: any) => c.playerId === p.id && (c.type === "RED" || c.type === "SECOND_YELLOW")).length,
      },
    });

    res.json({
      fixture: { id: fixture.id, matchDate: fixture.matchDate, status: fixture.status, homeScore: fixture.homeScore, awayScore: fixture.awayScore },
      homeTeam: { ...fixture.homeTeam, players: homePlayers.map(formatPlayer) },
      awayTeam: { ...fixture.awayTeam, players: awayPlayers.map(formatPlayer) },
      matchStats: { goals, assists, cards },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLiveStat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, statType, teamId, action } = req.body;
    if (!playerId || !statType || !teamId || !action) throw new AppError("playerId, statType, teamId, action required", 400);

    const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const isIncrement = action === "increment";

    if (statType === "goal") {
      const existing = await prisma.goal.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const goal = await prisma.goal.create({
          data: { fixtureId: fixture.id, playerId, minute: 0 },
        });
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "added", goal, count: goalCount });
      } else {
        if (existing) {
          await prisma.goal.delete({ where: { id: existing.id } });
        }
        const goalCount = await prisma.goal.count({ where: { fixtureId: fixture.id, playerId } });
        await recalcScore(fixture.id);
        res.json({ action: "removed", count: goalCount });
      }
    } else if (statType === "assist") {
      const existing = await prisma.assist.findFirst({ where: { fixtureId: fixture.id, playerId }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const assist = await prisma.assist.create({
          data: { fixtureId: fixture.id, playerId, minute: 0 },
        });
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "added", assist, count });
      } else {
        if (existing) {
          await prisma.assist.delete({ where: { id: existing.id } });
        }
        const count = await prisma.assist.count({ where: { fixtureId: fixture.id, playerId } });
        res.json({ action: "removed", count });
      }
    } else if (statType === "yellowCard" || statType === "redCard") {
      const cardType = statType === "yellowCard" ? "YELLOW" : "RED";
      const existing = await prisma.card.findFirst({ where: { fixtureId: fixture.id, playerId, type: cardType }, orderBy: { createdAt: "desc" } });
      if (isIncrement) {
        const card = await prisma.card.create({
          data: { fixtureId: fixture.id, playerId, type: cardType, minute: 0 },
        });
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "added", card, count });
      } else {
        if (existing) {
          await prisma.card.delete({ where: { id: existing.id } });
        }
        const count = await prisma.card.count({ where: { fixtureId: fixture.id, playerId, type: cardType } });
        res.json({ action: "removed", count });
      }
    } else {
      throw new AppError("Invalid statType", 400);
    }
  } catch (error) {
    next(error);
  }
};

async function recalcScore(fixtureId: string) {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { homeTeamId: true, awayTeamId: true } });
  if (!fixture) return;
  const homeGoals = await prisma.goal.count({
    where: { fixtureId, player: { teamId: fixture.homeTeamId } },
  });
  const awayGoals = await prisma.goal.count({
    where: { fixtureId, player: { teamId: fixture.awayTeamId } },
  });
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { homeScore: homeGoals, awayScore: awayGoals },
  });
}
