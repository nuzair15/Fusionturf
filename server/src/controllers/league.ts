import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginate, paginatedResponse, calculateMatchStats, searchPlayerIds } from "../utils/helpers.js";
import { LineupRow, serializeTeamLineup } from "../utils/lineup.js";
import { ACTIVE_MATCH_STATUSES, fixtureDisplayComparator, fixtureTimeDto } from "../utils/fixtures.js";
import { isValidDateOnly, legacyDateOnly, localNow, zonedDateTimeToUtc } from "../utils/time.js";
import { sanitizeRichText } from "../utils/content-security.js";

async function resolveSeasonId(requested?: unknown): Promise<string | undefined> {
  if (requested) return String(requested);
  const current = await prisma.season.findFirst({ where: { isCurrent: true, isActive: true, deletedAt: null }, select: { id: true } });
  return current?.id;
}

// Fixture dates are stored as calendar dates.  Comparing them to the current
// timestamp makes every match scheduled for today disappear after midnight.
function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// ─── Seasons ───

export const getSeasons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const seasons = await prisma.season.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: "desc" },
      include: { _count: { select: { teams: true, players: true, fixtures: true } } },
    });
    res.json(seasons);
  } catch (error) {
    next(error);
  }
};

export const getCurrentSeason = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const season = await prisma.season.findFirst({
      where: { isCurrent: true, isActive: true, deletedAt: null },
      include: { _count: { select: { teams: true, players: true, fixtures: true } } },
    });
    if (!season) throw new AppError("No active season found", 404);
    res.json(season);
  } catch (error) {
    next(error);
  }
};

export const getCompetitionBracket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competition = await prisma.competition.findFirst({
      where: { id: req.params.id, isActive: true, deletedAt: null },
      include: {
        bracketMatches: {
          include: {
            homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
            winnerTeam: { select: { id: true, name: true, shortName: true } },
            fixture: { select: { id: true, matchDate: true, kickoffTime: true, status: true, homeScore: true, awayScore: true } },
          },
          orderBy: [{ roundNumber: "asc" }, { position: "asc" }],
        },
      },
    });
    if (!competition) throw new AppError("Competition not found", 404);
    res.json(competition);
  } catch (error) { next(error); }
};

// ─── Teams ───

export const getTeams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seasonId = await resolveSeasonId(req.query.seasonId);
    const where: any = { isActive: true, deletedAt: null };
    if (seasonId) where.seasonId = seasonId;

    const teams = await prisma.team.findMany({
      where,
      include: {
        _count: { select: { players: { where: { isActive: true } }, homeMatches: true } },
        standings: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

export const getTeamBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const team = await prisma.team.findFirst({
      where: { slug: req.params.slug, isActive: true, deletedAt: null },
      include: {
        players: { where: { isActive: true, deletedAt: null }, orderBy: { jerseyNumber: "asc" }, include: { homeStats: true } },
        staff: { where: { deletedAt: null } },
        standings: { include: { season: true } },
        homeMatches: {
          where: { deletedAt: null },
          include: { awayTeam: { select: { name: true, slug: true, logoUrl: true } }, season: true },
          take: 100,
          orderBy: { matchDate: "desc" },
        },
        awayMatches: {
          where: { deletedAt: null },
          include: { homeTeam: { select: { name: true, slug: true, logoUrl: true } }, season: true },
          take: 100,
          orderBy: { matchDate: "desc" },
        },
        sponsors: { where: { isActive: true, deletedAt: null } },
        galleries: { where: { isActive: true, deletedAt: null }, take: 10, orderBy: { createdAt: "desc" } },
        news: { where: { isPublished: true, deletedAt: null }, take: 5, orderBy: { createdAt: "desc" } },
      },
    });
    if (!team) throw new AppError("Team not found", 404);

    // Friendly-match stats for each squad player, computed from friendly
    // fixtures (flag or FRIENDLY-type competition) so the club page can show
    // league and friendly numbers side by side.
    const playerIds = team.players.map((p) => p.id);
    const friendlyFixtures = await prisma.fixture.findMany({
      where: {
        deletedAt: null,
        seasonId: team.seasonId,
        status: "COMPLETED",
        AND: [
          { OR: [{ isFriendly: true }, { competition: { is: { type: "FRIENDLY" } } }] },
          { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
        ],
      },
      select: { id: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    });

    let goalsConceded = 0;
    let cleanSheets = 0;
    for (const f of friendlyFixtures) {
      const conceded = f.homeTeamId === team.id ? f.awayScore || 0 : f.homeScore || 0;
      goalsConceded += conceded;
      if (conceded === 0) cleanSheets++;
    }

    const fixtureIds = friendlyFixtures.map((f) => f.id);
    const [goals, assists, cards] = fixtureIds.length > 0
      ? await Promise.all([
          prisma.goal.groupBy({ by: ["playerId"], where: { playerId: { in: playerIds }, fixtureId: { in: fixtureIds } }, _count: { _all: true } }),
          prisma.assist.groupBy({ by: ["playerId"], where: { playerId: { in: playerIds }, fixtureId: { in: fixtureIds } }, _count: { _all: true } }),
          prisma.card.groupBy({ by: ["playerId", "type"], where: { playerId: { in: playerIds }, fixtureId: { in: fixtureIds } }, _count: { _all: true } }),
        ])
      : [[], [], []];

    const goalCounts = new Map(goals.map((g) => [g.playerId, g._count._all]));
    const assistCounts = new Map(assists.map((a) => [a.playerId, a._count._all]));
    const cardCounts = new Map<string, { yellow: number; red: number }>();
    for (const row of cards) {
      const current = cardCounts.get(row.playerId) || { yellow: 0, red: 0 };
      if (row.type === "YELLOW") current.yellow += row._count._all;
      if (row.type === "RED" || row.type === "SECOND_YELLOW") current.red += row._count._all;
      cardCounts.set(row.playerId, current);
    }

    const [playerAppearances, playerLineups] = await Promise.all([
      prisma.matchdaySquadEntry.findMany({
        where: { playerId: { in: playerIds }, squad: { fixtureId: { in: fixtureIds } } },
        select: { playerId: true, squad: { select: { fixtureId: true } } },
      }),
      prisma.lineup.findMany({
        where: { playerId: { in: playerIds }, fixtureId: { in: fixtureIds } },
        select: { playerId: true, fixtureId: true },
      }),
    ]);
    const appearanceMap = new Map<string, Set<string>>();
    playerAppearances.forEach((entry) => {
      const fixtures = appearanceMap.get(entry.playerId) || new Set<string>();
      fixtures.add(entry.squad.fixtureId);
      appearanceMap.set(entry.playerId, fixtures);
    });
    playerLineups.forEach((entry) => {
      const fixtures = appearanceMap.get(entry.playerId) || new Set<string>();
      fixtures.add(entry.fixtureId);
      appearanceMap.set(entry.playerId, fixtures);
    });

    team.players = team.players.map((p) => ({
      ...p,
      friendlyStats: {
        appearances: appearanceMap.get(p.id)?.size || 0,
        goals: goalCounts.get(p.id) || 0,
        assists: assistCounts.get(p.id) || 0,
        yellowCards: cardCounts.get(p.id)?.yellow || 0,
        redCards: cardCounts.get(p.id)?.red || 0,
        cleanSheets: p.position === "GK" ? cleanSheets : null,
        goalsConceded: p.position === "GK" ? goalsConceded : null,
      },
    }));

    res.json(team);
  } catch (error) {
    next(error);
  }
};

// ─── Players ───

export const getPlayers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { isActive: true, deletedAt: null };
    const seasonId = await resolveSeasonId(req.query.seasonId);
    if (seasonId) where.seasonId = seasonId;
    if (req.query.teamId) where.teamId = req.query.teamId;
    if (req.query.position) where.position = req.query.position;
    if (req.query.search) {
      const { ids, total } = await searchPlayerIds(req.query.search as string, {
        teamId: req.query.teamId as string,
        seasonId: req.query.seasonId as string,
        position: req.query.position as string,
        isActive: true,
        limit, offset: skip,
      });
      if (ids.length === 0) return res.json(paginatedResponse([], total, page, limit));
      where.id = { in: ids };
      const data = await prisma.player.findMany({
        where,
        include: {
          team: { select: { name: true, slug: true, logoUrl: true } },
          homeStats: { select: { goals: true, assists: true, appearances: true } },
        },
        orderBy: { firstName: "asc" },
      });
      return res.json(paginatedResponse(data, total, page, limit));
    }

    const [data, total] = await Promise.all([
      prisma.player.findMany({
        where,
        include: {
          team: { select: { name: true, slug: true, logoUrl: true } },
          homeStats: { select: { goals: true, assists: true, appearances: true } },
        },
        skip,
        take: limit,
        orderBy: { firstName: "asc" },
      }),
      prisma.player.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getPlayerBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await prisma.player.findFirst({
      where: { slug: req.params.slug, isActive: true, deletedAt: null },
      include: {
        team: true,
        homeStats: { include: { season: true, team: true } },
        friendlyStats: { include: { season: true, team: true } },
        awardNominations: { where: { award: { deletedAt: null, isActive: true } }, include: { award: true } },
        galleries: { where: { isActive: true, deletedAt: null }, take: 10, orderBy: { createdAt: "desc" } },
        transfers: {
          include: {
            fromTeam: { select: { id: true, name: true, slug: true } },
            toTeam: { select: { id: true, name: true, slug: true } },
            fromSeason: { select: { id: true, name: true } },
            toSeason: { select: { id: true, name: true } },
          },
          orderBy: { transferredAt: "desc" },
        },
      },
    });
    if (!player) throw new AppError("Player not found", 404);

    // Build a profile-ready view even when an admin has not created a manual
    // stats row yet. Appearances are based only on lineup or matchday-squad
    // participation, never on team fixture totals.
    const seasonIds = [...new Set([player.seasonId, ...player.homeStats.map((s) => s.seasonId), ...player.friendlyStats.map((s) => s.seasonId)])];
    const profileStats = (await Promise.all(seasonIds.map(async (seasonId) => {
      const rows = await Promise.all([false, true].map(async (friendly) => {
        const fixtures = await prisma.fixture.findMany({
          where: {
            deletedAt: null,
            seasonId,
            status: "COMPLETED",
            ...(friendly
              ? { OR: [{ isFriendly: true }, { competition: { is: { type: "FRIENDLY" } } }] }
              : { isFriendly: false, OR: [{ competitionId: null }, { competition: { is: { type: { not: "FRIENDLY" } } } }] }),
          },
          select: { id: true },
        });
        const fixtureIds = fixtures.map((f) => f.id);
        const [lineups, squadEntries, goals, assists, cards, ratings] = fixtureIds.length ? await Promise.all([
          prisma.lineup.findMany({ where: { playerId: player.id, fixtureId: { in: fixtureIds } }, select: { fixtureId: true } }),
          prisma.matchdaySquadEntry.findMany({ where: { playerId: player.id, squad: { fixtureId: { in: fixtureIds } } }, select: { squad: { select: { fixtureId: true } } } }),
          prisma.goal.count({ where: { playerId: player.id, fixtureId: { in: fixtureIds }, isOwnGoal: false } }),
          prisma.assist.count({ where: { playerId: player.id, fixtureId: { in: fixtureIds } } }),
          prisma.card.findMany({ where: { playerId: player.id, fixtureId: { in: fixtureIds } }, select: { type: true } }),
          prisma.matchPlayerRating.aggregate({ where: { playerId: player.id, fixtureId: { in: fixtureIds } }, _avg: { rating: true } }),
        ]) : [[], [], 0, 0, [], { _avg: { rating: null } }];
        const eligible = new Set([...lineups.map((x: any) => x.fixtureId), ...squadEntries.map((x: any) => x.squad.fixtureId)]).size;
        const manual: any = (friendly ? player.friendlyStats : player.homeStats).find((s) => s.seasonId === seasonId && s.teamId === player.teamId);
        return {
          ...(manual || {}), id: manual?.id || `${friendly ? "friendly" : "league"}-${seasonId}-${player.id}`,
          seasonId, season: manual?.season || { id: seasonId, name: "Season" }, team: manual?.team || player.team,
          competition: friendly ? "FRIENDLY" : "LEAGUE", appearances: Math.min(manual?.appearances ?? eligible, eligible),
          goals: manual?.goals ?? goals, assists: manual?.assists ?? assists,
          yellowCards: manual?.yellowCards ?? cards.filter((c: any) => c.type === "YELLOW").length,
          redCards: manual?.redCards ?? cards.filter((c: any) => c.type === "RED" || c.type === "SECOND_YELLOW").length,
          averageRating: manual?.averageRating ?? ratings._avg.rating,
        };
      }));
      return rows;
    }))).flat();
    res.json({ ...player, profileStats });
  } catch (error) {
    next(error);
  }
};

// ─── Fixtures ───

const getFixturesLegacy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { deletedAt: null };
    const seasonId = await resolveSeasonId(req.query.seasonId);
    if (seasonId) where.seasonId = seasonId;
    if (req.query.teamId) where.OR = [{ homeTeamId: req.query.teamId }, { awayTeamId: req.query.teamId }];
    if (req.query.status) where.status = req.query.status;
    if (req.query.competitionId) where.competitionId = req.query.competitionId;
    if (req.query.venueId) where.venueId = req.query.venueId;
    if (req.query.round) where.round = Number(req.query.round);
    if (req.query.from || req.query.to) {
      where.matchDate = {};
      if (req.query.from) where.matchDate.gte = new Date(String(req.query.from));
      if (req.query.to) where.matchDate.lte = new Date(`${String(req.query.to)}T23:59:59.999`);
    }
    if (req.query.date) {
      const date = new Date(req.query.date as string);
      where.matchDate = { gte: new Date(date.setHours(0, 0, 0, 0)), lte: new Date(date.setHours(23, 59, 59, 999)) };
    }

    // `upcoming=true` returns the nearest unplayed fixtures first (ascending
    // date, starting now) instead of the default newest-date-first order —
    // the default put the season's final rounds on the home page instead of
    // the matches about to be played.
    const upcoming = req.query.upcoming === "true";
    if (upcoming) {
      where.matchDate = { ...(where.matchDate || {}), gte: startOfToday() };
      where.status = { in: ["SCHEDULED", "LIVE", "HALF_TIME", "PAUSED", "EXTRA_TIME", "PENALTIES"] };
    }

    const [data, total] = await Promise.all([
      prisma.fixture.findMany({
        where,
        include: {
          homeTeam: { select: { name: true, slug: true, logoUrl: true } },
          awayTeam: { select: { name: true, slug: true, logoUrl: true } },
          season: { select: { name: true, slug: true } },
          competition: { select: { name: true } },
          goals: { include: { player: { select: { firstName: true, lastName: true } } } },
        },
        skip,
        take: limit,
        orderBy: upcoming ? { matchDate: "asc" } : { matchDate: "desc" },
      }),
      prisma.fixture.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getFixtures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const requestedScope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const scope = requestedScope || (req.query.upcoming === "true" ? "upcoming" : undefined);
    if (scope && !["live", "upcoming", "recent", "range"].includes(scope)) throw new AppError("scope must be live, upcoming, recent, or range", 400);
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    if (from && !isValidDateOnly(from)) throw new AppError("from must use YYYY-MM-DD", 400);
    if (to && !isValidDateOnly(to)) throw new AppError("to must use YYYY-MM-DD", 400);
    if (from && to && from > to) throw new AppError("from must not be after to", 400);

    const seasonId = await resolveSeasonId(req.query.seasonId);
    const competition = req.query.competitionId
      ? await prisma.competition.findFirst({ where: { id: String(req.query.competitionId), deletedAt: null }, select: { timezone: true } })
      : null;
    const timezone = competition?.timezone || "Asia/Kolkata";
    const today = localNow(timezone).date;
    const baseWhere: any = { deletedAt: null };
    if (seasonId) baseWhere.seasonId = seasonId;
    if (req.query.teamId) baseWhere.OR = [{ homeTeamId: req.query.teamId }, { awayTeamId: req.query.teamId }];
    if (req.query.status) baseWhere.status = req.query.status;
    if (req.query.competitionId) baseWhere.competitionId = req.query.competitionId;
    if (req.query.venueId) baseWhere.venueId = req.query.venueId;
    if (req.query.round) baseWhere.round = Number(req.query.round);
    if (req.query.date) {
      const date = String(req.query.date);
      if (!isValidDateOnly(date)) throw new AppError("date must use YYYY-MM-DD", 400);
      baseWhere.scheduledDate = date;
    } else if (from || to) {
      baseWhere.scheduledDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    const include = {
      homeTeam: { select: { name: true, slug: true, logoUrl: true } },
      awayTeam: { select: { name: true, slug: true, logoUrl: true } },
      season: { select: { name: true, slug: true } },
      competition: { select: { name: true, timezone: true } },
      goals: { include: { player: { select: { firstName: true, lastName: true } } } },
    } as const;
    const statusWasRequested = typeof req.query.status === "string";
    const statusMatches = (allowed: string[]) => !statusWasRequested || allowed.includes(String(req.query.status));
    if (scope === "range") {
      const [rows, total] = await Promise.all([
        prisma.fixture.findMany({
          where: baseWhere,
          include,
          orderBy: [{ scheduledDate: "asc" }, { kickoffAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
          skip,
          take: limit,
        }),
        prisma.fixture.count({ where: baseWhere }),
      ]);
      const normalized = rows
        .map((fixture) => fixtureTimeDto(fixture, fixture.competition?.timezone || timezone))
        .sort(fixtureDisplayComparator(timezone));
      return res.json(paginatedResponse(normalized, total, page, limit));
    }
    const buckets: Array<{ where: any; orderBy: any }> = [];
    if ((!scope || scope === "live" || scope === "upcoming" || scope === "range") && statusMatches(ACTIVE_MATCH_STATUSES)) {
      buckets.push({
        where: { ...baseWhere, status: statusWasRequested ? req.query.status : { in: ACTIVE_MATCH_STATUSES } },
        orderBy: [{ scheduledDate: "asc" }, { kickoffAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      });
    }
    if ((!scope || scope === "upcoming" || scope === "range") && statusMatches(["SCHEDULED"])) {
      const scheduledBase = { ...baseWhere, status: "SCHEDULED" };
      buckets.push({ where: { ...scheduledBase, scheduledDate: today }, orderBy: [{ kickoffAt: { sort: "asc", nulls: "last" } }, { id: "asc" }] });
      buckets.push({ where: { ...scheduledBase, scheduledDate: { gt: today } }, orderBy: [{ scheduledDate: "asc" }, { kickoffAt: { sort: "asc", nulls: "last" } }, { id: "asc" }] });
    }
    if ((!scope || scope === "recent" || scope === "range") && statusMatches(["COMPLETED"])) {
      buckets.push({
        where: { ...baseWhere, status: "COMPLETED" },
        orderBy: [{ scheduledDate: "desc" }, { kickoffAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      });
    }
    if (!scope || scope === "range") {
      const excluded = [...ACTIVE_MATCH_STATUSES, "SCHEDULED", "COMPLETED"];
      if (!statusWasRequested || !excluded.includes(String(req.query.status))) {
        buckets.push({
          where: { ...baseWhere, ...(statusWasRequested ? {} : { status: { notIn: [...ACTIVE_MATCH_STATUSES, "SCHEDULED", "COMPLETED"] } }) },
          orderBy: [{ scheduledDate: "desc" }, { kickoffAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
        });
      }
    }

    const counts = await Promise.all(buckets.map((bucket) => prisma.fixture.count({ where: bucket.where })));
    const total = counts.reduce((sum, count) => sum + count, 0);
    let remainingSkip = skip;
    let remainingTake = limit;
    const data: any[] = [];
    for (let index = 0; index < buckets.length && remainingTake > 0; index += 1) {
      const count = counts[index];
      if (remainingSkip >= count) {
        remainingSkip -= count;
        continue;
      }
      const rows = await prisma.fixture.findMany({
        where: buckets[index].where,
        include,
        orderBy: buckets[index].orderBy,
        skip: remainingSkip,
        take: remainingTake,
      });
      data.push(...rows);
      remainingTake -= rows.length;
      remainingSkip = 0;
    }
    const normalized = data
      .map((fixture) => fixtureTimeDto(fixture, fixture.competition?.timezone || timezone))
      .sort(fixtureDisplayComparator(timezone));
    res.json(paginatedResponse(normalized, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getFixtureById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: true,
        competition: true,
        venue: true,
        goals: { include: { player: true }, orderBy: { minute: "asc" } },
        assists: { include: { player: true }, orderBy: { minute: "asc" } },
        cards: { include: { player: true }, orderBy: { minute: "asc" } },
        substitutions: {
          include: { playerOff: true, playerOn: true },
          orderBy: { minute: "asc" },
        },
        lineups: {
          include: { player: true },
          orderBy: [{ isStarter: "desc" }, { position: "asc" }],
        },
        matchPlayerRatings: {
          include: { player: { select: { id: true, slug: true, firstName: true, lastName: true, teamId: true } } },
          orderBy: { rating: "desc" },
        },
        comments: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
        },
        manOfTheMatch: true,
        galleries: { take: 10 },
      },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);
    res.json(fixture);
  } catch (error) {
    next(error);
  }
};

// ─── Lineups ───

export const getFixtureLineups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fixture = await prisma.fixture.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        lineups: {
          include: {
            player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true } },
          },
          orderBy: [{ isStarter: "desc" }, { position: "asc" }],
        },
      },
    });
    if (!fixture) throw new AppError("Fixture not found", 404);

    const homeRows = fixture.lineups.filter((l) => l.teamId === fixture.homeTeamId) as LineupRow[];
    const awayRows = fixture.lineups.filter((l) => l.teamId === fixture.awayTeamId) as LineupRow[];

    res.json({
      fixtureId: fixture.id,
      home: serializeTeamLineup(fixture.homeTeam, homeRows, true),
      away: serializeTeamLineup(fixture.awayTeam, awayRows, false),
    });
  } catch (error) {
    next(error);
  }
};

// ─── Standings ───

export const getStandings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    const seasonId = await resolveSeasonId(req.query.seasonId);
    if (seasonId) {
      where.seasonId = seasonId;
    }
    if (req.query.competitionId) {
      const fixtures = await prisma.fixture.findMany({
        where: { competitionId: req.query.competitionId as string, seasonId, status: "COMPLETED", deletedAt: null },
        select: { homeTeamId: true, awayTeamId: true },
      });
      const teamIds = [...new Set(fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]))];
      where.teamId = { in: teamIds };
    }

    const standings = await prisma.standing.findMany({
      where,
      include: {
        team: { select: { name: true, slug: true, logoUrl: true, shortName: true } },
      },
      orderBy: { position: "asc" },
    });
    res.json(standings);
  } catch (error) {
    next(error);
  }
};

// ─── Statistics ───

export const getTopScorers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    const seasonId = await resolveSeasonId(req.query.seasonId);
    if (seasonId) where.seasonId = seasonId;
    const players = await prisma.playerStat.findMany({
      where,
      include: {
        player: { select: { firstName: true, lastName: true, photoUrl: true, position: true } },
        team: { select: { name: true, slug: true, logoUrl: true } },
      },
      orderBy: { goals: "desc" },
      take: Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10) || 20)),
    });
    res.json(players);
  } catch (error) {
    next(error);
  }
};

export const getTopAssists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    const seasonId = await resolveSeasonId(req.query.seasonId);
    if (seasonId) where.seasonId = seasonId;

    const players = await prisma.playerStat.findMany({
      where,
      include: {
        player: { select: { firstName: true, lastName: true, photoUrl: true, position: true } },
        team: { select: { name: true, slug: true, logoUrl: true } },
      },
      orderBy: { assists: "desc" },
      take: 20,
    });
    res.json(players);
  } catch (error) {
    next(error);
  }
};

export const getPlayerStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seasonId = await resolveSeasonId(req.query.seasonId);
    const motmQuery = async (friendly: boolean) => {
      const fixtures = await prisma.fixture.findMany({
        where: {
          seasonId,
          deletedAt: null,
          manOfTheMatchId: { not: null },
          ...(friendly
            ? { OR: [{ isFriendly: true }, { competition: { is: { type: "FRIENDLY" } } }] }
            : { isFriendly: false, OR: [{ competitionId: null }, { competition: { is: { type: { not: "FRIENDLY" } } } }] }),
        },
        select: { manOfTheMatchId: true },
      });
      const map = new Map<string, number>();
      fixtures.forEach((f) => {
        if (f.manOfTheMatchId) map.set(f.manOfTheMatchId, (map.get(f.manOfTheMatchId) || 0) + 1);
      });
      return map;
    };

    if (req.query.friendly === "true") {
      const fixtures = await prisma.fixture.findMany({
        where: { seasonId, status: "COMPLETED", deletedAt: null, OR: [{ isFriendly: true }, { competition: { is: { type: "FRIENDLY" } } }] },
        select: { id: true, homeTeamId: true, awayTeamId: true },
      });
      const fixtureIds = fixtures.map((f) => f.id);
      const [goals, assists, cards, lineups, squadEntries, players, motm] = await Promise.all([
        prisma.goal.groupBy({ by: ["playerId"], where: { fixtureId: { in: fixtureIds }, isOwnGoal: false }, _count: { _all: true } }),
        prisma.assist.groupBy({ by: ["playerId"], where: { fixtureId: { in: fixtureIds } }, _count: { _all: true } }),
        prisma.card.groupBy({ by: ["playerId", "type"], where: { fixtureId: { in: fixtureIds } }, _count: { _all: true } }),
        prisma.lineup.findMany({ where: { fixtureId: { in: fixtureIds } }, select: { fixtureId: true, playerId: true } }),
        prisma.matchdaySquadEntry.findMany({ where: { squad: { fixtureId: { in: fixtureIds } } }, select: { playerId: true, squad: { select: { fixtureId: true } } } }),
        prisma.player.findMany({ where: { seasonId, isActive: true, deletedAt: null }, include: { team: { select: { name: true, slug: true, logoUrl: true } } } }),
        motmQuery(true),
      ]);
      const goalMap = new Map(goals.map((g) => [g.playerId, g._count._all]));
      const assistMap = new Map(assists.map((a) => [a.playerId, a._count._all]));
      const cardMap = new Map<string, { yellow: number; red: number }>();
      cards.forEach((c) => { const x = cardMap.get(c.playerId) || { yellow: 0, red: 0 }; if (c.type === "YELLOW") x.yellow += c._count._all; else x.red += c._count._all; cardMap.set(c.playerId, x); });
      const appearanceMap = new Map<string, Set<string>>();
      lineups.forEach((lineup) => { const set = appearanceMap.get(lineup.playerId) || new Set<string>(); set.add(lineup.fixtureId); appearanceMap.set(lineup.playerId, set); });
      squadEntries.forEach((entry) => { const set = appearanceMap.get(entry.playerId) || new Set<string>(); set.add(entry.squad.fixtureId); appearanceMap.set(entry.playerId, set); });
      const result = players.map((p) => ({ id: `friendly-${p.id}`, playerId: p.id, teamId: p.teamId, player: p, team: p.team, appearances: appearanceMap.get(p.id)?.size || 0, goals: goalMap.get(p.id) || 0, assists: assistMap.get(p.id) || 0, yellowCards: cardMap.get(p.id)?.yellow || 0, redCards: cardMap.get(p.id)?.red || 0, manOfTheMatch: motm.get(p.id) || 0 })).filter((p) => p.appearances || p.goals || p.assists || p.yellowCards || p.redCards || p.manOfTheMatch);
      return res.json(result.sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists)));
    }
    const where: any = {};
    if (seasonId) where.seasonId = seasonId;
    if (req.query.stat) {
      const statMap: Record<string, any> = {
        goals: { goals: "desc" },
        assists: { assists: "desc" },
        cleanSheets: { cleanSheets: "desc" },
        saves: { saves: "desc" },
        appearances: { appearances: "desc" },
        passAccuracy: { passAccuracy: "desc" },
        tackles: { tackles: "desc" },
        interceptions: { interceptions: "desc" },
        yellowCards: { yellowCards: "desc" },
        redCards: { redCards: "desc" },
        rating: { averageRating: "desc" },
      };
      const orderBy = statMap[req.query.stat as string] || { goals: "desc" };

      if (req.query.stat === "motm") {
        const motm = await motmQuery(false);
        const players = await prisma.player.findMany({
          where: { seasonId, isActive: true, deletedAt: null, id: { in: [...motm.keys()] } },
          include: {
            team: { select: { name: true, slug: true, logoUrl: true } },
            homeStats: { where: { seasonId } },
          },
        });
        const rows = players.map((p) => ({
          id: `motm-${p.id}`,
          playerId: p.id,
          teamId: p.teamId,
          seasonId,
          player: p,
          team: p.team,
          manOfTheMatch: motm.get(p.id) || 0,
          appearances: p.homeStats[0]?.appearances || 0,
        })).sort((a, b) => b.manOfTheMatch - a.manOfTheMatch);
        return res.json(rows);
      }

      const players = await prisma.playerStat.findMany({
        where,
        include: {
          player: { select: { firstName: true, lastName: true, photoUrl: true, position: true } },
          team: { select: { name: true, slug: true, logoUrl: true } },
        },
        orderBy,
        take: 50,
      });
      return res.json(players);
    }

    const stats = await prisma.playerStat.findMany({
      where,
      include: {
        player: { select: { firstName: true, lastName: true, photoUrl: true } },
        team: { select: { name: true, slug: true } },
      },
      orderBy: { averageRating: "desc" },
      take: 50,
    });
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getTeamStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.query.seasonId) where.seasonId = req.query.seasonId;
    const stats = await prisma.teamStat.findMany({
      where,
      include: { team: { select: { name: true, slug: true, logoUrl: true, shortName: true } } },
      orderBy: { totalGoals: "desc" },
      take: 50,
    });
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// ─── Awards ───

export const getAwards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { isActive: true, deletedAt: null };
    if (req.query.seasonId) where.seasonId = req.query.seasonId;

    const awards = await prisma.award.findMany({
      where,
      include: {
        winner: { select: { firstName: true, lastName: true, photoUrl: true } },
        winnerTeam: { select: { name: true, logoUrl: true } },
        _count: { select: { votes: true, nominations: true } },
        previousWinners: {
          include: { player: { select: { firstName: true, lastName: true, photoUrl: true } }, team: { select: { name: true, logoUrl: true } }, season: { select: { name: true } } },
          orderBy: { year: "desc" },
          take: 5,
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(awards);
  } catch (error) {
    next(error);
  }
};

export const getAwardBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const award = await prisma.award.findFirst({
      where: { slug: req.params.slug, deletedAt: null },
      include: {
        winner: true,
        winnerTeam: true,
        nominations: {
          include: { player: { include: { team: { select: { name: true, logoUrl: true } } } } },
        },
        previousWinners: {
          include: { player: true, team: { select: { name: true, logoUrl: true } }, season: { select: { name: true } } },
          orderBy: { year: "desc" },
        },
      },
    });
    if (!award) throw new AppError("Award not found", 404);
    res.json(award);
  } catch (error) {
    next(error);
  }
};

export const voteForAward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({ awardId: z.string().uuid(), nomineeId: z.string().uuid() }).parse(req.body);
    if (!req.user) throw new AppError("Authentication required", 401);
    const { awardId, nomineeId } = input;
    const award = await prisma.award.findFirst({ where: { id: awardId, isActive: true, deletedAt: null } });
    if (!award) throw new AppError("Award not found", 404);
    if (!award.votingEnabled) throw new AppError("Voting is disabled for this award", 400);
    if (award.votingType === "DISABLED") throw new AppError("Voting is disabled", 400);
    // Public/device/anonymous/OTP/captcha modes are intentionally unavailable
    // until their complete integrity controls are implemented.
    if (award.votingType === "PUBLIC" || award.allowAnonymous || award.requireOTP || award.requireCaptcha || award.deviceFingerprint) {
      throw new AppError("This voting mode is not currently supported", 409, "VOTING_MODE_UNAVAILABLE");
    }
    if (["ONCE_PER_DEVICE", "MULTIPLE"].includes(award.voteFrequency)) {
      throw new AppError("This voting frequency is not currently supported", 409, "VOTING_MODE_UNAVAILABLE");
    }
    if (award.votingType === "ADMIN_ONLY" && req.user.role === "CUSTOMER") {
      throw new AppError("Only admins can vote", 403);
    }

    const now = new Date();
    if (award.votingStartDate && now < award.votingStartDate) {
      throw new AppError("Voting has not started yet", 400);
    }
    if (award.votingEndDate && now > award.votingEndDate) {
      throw new AppError("Voting period has ended", 400);
    }
    const nomination = await prisma.awardNomination.findUnique({
      where: { awardId_playerId: { awardId, playerId: nomineeId } },
      select: { id: true },
    });
    if (!nomination) throw new AppError("The selected player is not a nominee for this award", 400, "INVALID_NOMINEE");
    if (award.requireEmailVerification) {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { emailVerified: true } });
      if (!user?.emailVerified) throw new AppError("Email verification is required", 403, "EMAIL_NOT_VERIFIED");
    }

    const timezone = "Asia/Kolkata";
    let createdAt: { gte?: Date; lt?: Date } | undefined;
    if (award.voteFrequency === "ONCE_PER_DAY") {
      const dateOnly = localNow(timezone, now).date;
      const tomorrow = new Date(legacyDateOnly(dateOnly).getTime() + 86_400_000).toISOString().slice(0, 10);
      createdAt = {
        gte: zonedDateTimeToUtc(dateOnly, "00:00", timezone),
        lt: zonedDateTimeToUtc(tomorrow, "00:00", timezone),
      };
    }

    const vote = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`award-vote:${awardId}:${req.user!.userId}`}))`;
      const existing = await tx.vote.findFirst({
        where: {
          awardId,
          userId: req.user!.userId,
          ...(award.voteFrequency === "ONCE_PER_DAY" ? { createdAt } : {}),
        },
        select: { id: true },
      });
      if (existing) throw new AppError("You have already voted in the allowed period", 409, "ALREADY_VOTED");
      return tx.vote.create({
        data: {
          awardId,
          nomineeId,
          userId: req.user!.userId,
          isAnonymous: false,
          // Kept internally for abuse investigation; never exposed publicly.
          ipAddress: award.ipProtection ? req.ip : null,
          status: award.voteModeration || award.manualApproval ? "PENDING" : "APPROVED",
        },
        select: { id: true, status: true, createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
    res.status(201).json(vote);
  } catch (error) {
    next(error);
  }
};

// ─── News ───

export const getNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { isPublished: true, deletedAt: null };
    if (req.query.seasonId) where.seasonId = req.query.seasonId;
    if (req.query.teamId) where.teamId = req.query.teamId;

    const [data, total] = await Promise.all([
      prisma.news.findMany({
        where,
        include: { team: { select: { name: true, slug: true, logoUrl: true } } },
        skip,
        take: limit,
        orderBy: { publishedAt: "desc" },
      }),
      prisma.news.count({ where }),
    ]);
    res.json(paginatedResponse(data.map((article) => ({
      ...article,
      content: sanitizeRichText(article.content) || "",
    })), total, page, limit));
  } catch (error) {
    next(error);
  }
};

// ─── Gallery ───

export const getGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { isActive: true, deletedAt: null };
    if (req.query.seasonId) where.seasonId = req.query.seasonId;
    if (req.query.teamId) where.teamId = req.query.teamId;
    if (req.query.fixtureId) where.fixtureId = req.query.fixtureId;

    const items = await prisma.gallery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const getSponsors = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { tier: "asc" },
    });
    res.json({ data: sponsors });
  } catch (error) {
    next(error);
  }
};

// ─── League System ───

export const getMatchdaySquad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const squad = await prisma.matchdaySquad.findMany({
      where: { fixtureId: req.params.id },
      include: {
        team: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        entries: { include: { player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true } } } },
      },
    });
    res.json({ data: squad });
  } catch (error) {
    next(error);
  }
};

export const getSuspensions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId, teamId } = req.query;
    const where: any = { isActive: true, deletedAt: null };
    if (seasonId) where.seasonId = seasonId;
    if (teamId) where.player = { teamId: teamId as string };
    const suspensions = await prisma.suspension.findMany({
      where,
      include: {
        player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, team: { select: { id: true, name: true, shortName: true, logoUrl: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: suspensions });
  } catch (error) {
    next(error);
  }
};

export const getPlayerSuspensions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suspensions = await prisma.suspension.findMany({
      where: { playerId: req.params.playerId, isActive: true, deletedAt: null },
      include: { season: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: suspensions });
  } catch (error) {
    next(error);
  }
};

export const getAwardLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seasonId } = req.query;
    const where: any = {};
    if (seasonId) where.seasonId = seasonId;

    const stats = await prisma.playerStat.findMany({
      where,
      include: {
        player: { select: { id: true, firstName: true, lastName: true, photoUrl: true, jerseyNumber: true, position: true, team: { select: { id: true, name: true, shortName: true, logoUrl: true } } } },
      },
      orderBy: [{ goals: "desc" }, { assists: "desc" }],
      take: 20,
    });

    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
};
