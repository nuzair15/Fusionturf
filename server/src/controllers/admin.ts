import { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginate, paginatedResponse } from "../utils/helpers.js";

// ─── Seasons Management ───

export const createSeason = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await prisma.season.create({
      data: { ...req.body, managedById: req.user!.userId },
    });
    res.status(201).json(season);
  } catch (error) {
    next(error);
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

export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const team = await prisma.team.create({
      data: { ...req.body, managedById: req.user!.userId },
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

export const createAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const award = await prisma.award.create({
      data: { ...req.body, managedById: req.user!.userId },
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
