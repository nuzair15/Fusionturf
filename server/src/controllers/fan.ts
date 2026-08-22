import { Request, Response, NextFunction } from "express";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ACTIVE_MATCH_STATUSES, fixtureDisplayComparator, fixtureTimeDto } from "../utils/fixtures.js";
import { localNow } from "../utils/time.js";

export const getFanDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const follows = await prisma.userFollow.findMany({ where: { userId }, select: { teamId: true, playerId: true } });
    const teamIds = follows.flatMap((f) => f.teamId ? [f.teamId] : []);
    const playerIds = follows.flatMap((f) => f.playerId ? [f.playerId] : []);
    const today = localNow("Asia/Kolkata").date;
    const upcomingRows = await prisma.fixture.findMany({
      where: { deletedAt: null, OR: [{ status: { in: ACTIVE_MATCH_STATUSES } }, { status: "SCHEDULED", scheduledDate: { gte: today } }], AND: [{ OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] }] },
      include: { homeTeam: true, awayTeam: true, venue: true, competition: { select: { timezone: true } } }, take: 50,
    });
    const upcoming = upcomingRows.map((fixture) => fixtureTimeDto(fixture, fixture.competition?.timezone || "Asia/Kolkata")).sort(fixtureDisplayComparator("Asia/Kolkata")).slice(0, 8);
    const recent = await prisma.fixture.findMany({
      where: { deletedAt: null, status: "COMPLETED", OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] },
      include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: "desc" }, take: 8,
    });
    const [standings, playerStats, notifications] = await Promise.all([
      prisma.standing.findMany({ where: { teamId: { in: teamIds }, team: { deletedAt: null } }, include: { team: true }, orderBy: { position: "asc" } }),
      prisma.playerStat.findMany({ where: { playerId: { in: playerIds } }, include: { player: true, team: true }, orderBy: { season: { startDate: "desc" } } }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);
    res.json({ follows, upcoming, recent, standings, playerStats, notifications });
  } catch (e) { next(e); }
};

export const getFollows = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const follows = await prisma.userFollow.findMany({ where: { userId: req.user!.userId }, include: { team: true, player: true } });
    res.json(follows.filter((follow) =>
      (!follow.teamId || (follow.team?.deletedAt == null && follow.team?.isActive))
      && (!follow.playerId || (follow.player?.deletedAt == null && follow.player?.isActive))
    ));
  } catch (e) { next(e); }
};

export const toggleFollow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, entityId, notify = true } = req.body as { type: "TEAM" | "PLAYER"; entityId: string; notify?: boolean };
    if (!entityId || !["TEAM", "PLAYER"].includes(type)) throw new AppError("Invalid follow target", 400);
    const targetExists = type === "TEAM"
      ? await prisma.team.findFirst({ where: { id: entityId, isActive: true, deletedAt: null }, select: { id: true } })
      : await prisma.player.findFirst({ where: { id: entityId, isActive: true, deletedAt: null }, select: { id: true } });
    if (!targetExists) throw new AppError("Follow target not found", 404);
    const where = type === "TEAM" ? { userId_teamId: { userId: req.user!.userId, teamId: entityId } } : { userId_playerId: { userId: req.user!.userId, playerId: entityId } };
    const existing = await prisma.userFollow.findUnique({ where });
    if (existing) { await prisma.userFollow.delete({ where: { id: existing.id } }); return res.json({ following: false }); }
    const created = await prisma.userFollow.create({ data: { userId: req.user!.userId, type, notify, ...(type === "TEAM" ? { teamId: entityId } : { playerId: entityId }) } });
    res.status(201).json({ following: true, follow: created });
  } catch (e) { next(e); }
};

export const updateRsvp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.body.status as "GOING" | "MAYBE" | "NOT_GOING";
    if (!["GOING", "MAYBE", "NOT_GOING"].includes(status)) throw new AppError("Invalid RSVP", 400);
    const fixture = await prisma.fixture.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    const rsvp = await prisma.matchRsvp.upsert({ where: { fixtureId_userId: { fixtureId: req.params.id, userId: req.user!.userId } }, create: { fixtureId: req.params.id, userId: req.user!.userId, status }, update: { status } });
    res.json(rsvp);
  } catch (e) { next(e); }
};

export const getRsvp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true } });
    if (!fixture) throw new AppError("Fixture not found", 404);
    res.json(await prisma.matchRsvp.findUnique({ where: { fixtureId_userId: { fixtureId: req.params.id, userId: req.user!.userId } } }));
  } catch (e) { next(e); }
};

export const getHeadToHead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamA, teamB } = req.query as { teamA: string; teamB: string };
    const fixtures = await prisma.fixture.findMany({ where: { deletedAt: null, status: "COMPLETED", OR: [{ homeTeamId: teamA, awayTeamId: teamB }, { homeTeamId: teamB, awayTeamId: teamA }] }, include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: "desc" }, take: 20 });
    res.json(fixtures);
  } catch (e) { next(e); }
};

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "").trim(); if (q.length < 2) return res.json({ teams: [], players: [], fixtures: [], venues: [], news: [] });
    const contains = { contains: q, mode: "insensitive" as const };
    const [teams, players, fixtures, venues, news] = await Promise.all([
      prisma.team.findMany({ where: { isActive: true, deletedAt: null, season: { deletedAt: null, isActive: true }, OR: [{ name: contains }, { shortName: contains }] }, take: 5 }),
      prisma.player.findMany({ where: { isActive: true, deletedAt: null, team: { deletedAt: null, isActive: true, season: { deletedAt: null, isActive: true } }, OR: [{ firstName: contains }, { lastName: contains }, { slug: contains }] }, include: { team: true }, take: 5 }),
      prisma.fixture.findMany({ where: { deletedAt: null, season: { deletedAt: null, isActive: true }, homeTeam: { deletedAt: null, isActive: true }, awayTeam: { deletedAt: null, isActive: true }, OR: [{ homeTeam: { name: contains } }, { awayTeam: { name: contains } }] }, include: { homeTeam: true, awayTeam: true }, take: 100 }),
      prisma.venue.findMany({ where: { isActive: true, deletedAt: null, OR: [{ name: contains }, { city: contains }, { address: contains }] }, take: 5 }),
      prisma.news.findMany({ where: { isPublished: true, deletedAt: null, OR: [{ title: contains }, { excerpt: contains }] }, take: 5 }),
    ]);
    fixtures.sort(fixtureDisplayComparator("Asia/Kolkata"));
    res.json({ teams, players, fixtures: fixtures.slice(0, 5), venues, news });
  } catch (e) { next(e); }
};

export const getPolls = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const polls = await prisma.poll.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        AND: [
          { OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
          { OR: [{ fixtureId: null }, { fixture: { deletedAt: null } }] },
        ],
      },
      include: { options: { include: { player: true, _count: { select: { votes: true } } } }, fixture: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(polls.map((poll) => ({
      ...poll,
      options: poll.options.filter((option) => !option.playerId || (option.player?.deletedAt == null && option.player?.isActive)),
    })));
  } catch (e) { next(e); }
};

export const votePoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pollId = req.params.id;
    const optionId = typeof req.body.optionId === "string" ? req.body.optionId : "";
    if (!optionId) throw new AppError("optionId is required", 400);

    const poll = await prisma.poll.findFirst({ where: { id: pollId, deletedAt: null }, select: { id: true, isActive: true, closesAt: true } });
    if (!poll) throw new AppError("Poll not found", 404);
    if (!poll.isActive || (poll.closesAt && poll.closesAt <= new Date())) throw new AppError("Poll is closed", 400);

    // Checking the relation in the same query prevents an option from a
    // different poll being injected into this vote.
    const option = await prisma.pollOption.findFirst({ where: { id: optionId, pollId }, select: { id: true } });
    if (!option) throw new AppError("Option does not belong to this poll", 400);

    try {
      const vote = await prisma.pollVote.create({ data: { pollId, optionId, userId: req.user!.userId } });
      res.status(201).json(vote);
    } catch (error: any) {
      if (error?.code === "P2002") throw new AppError("You have already voted in this poll", 409);
      throw error;
    }
  } catch (e) { next(e); }
};
