import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";
import { localNow } from "../../utils/time.js";

// Users, platform settings, dashboard stats, activity logs, and global search


const VALID_USER_ROLES = [
  "SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER", "CONTENT_EDITOR",
  "REFEREE", "STATISTICIAN", "VIEWER", "CUSTOMER",
] as const;

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
    const { role } = req.body;
    if (!VALID_USER_ROLES.includes(role)) throw new AppError("Invalid role", 400);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// ─── Dashboard Analytics ───

function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;
  switch (period) {
    case "week":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { start, end };
}

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

// Public pages need branding and locale only. SMTP, payment, invoice and
// operational settings must never be serialized by the unauthenticated API.
const PUBLIC_SETTING_KEYS = [
  "site_name", "site_logo_url", "site_hero_url", "site_favicon_url",
  "currency", "timezone", "contact_email", "contact_phone",
  "facebook_url", "instagram_url", "youtube_url",
] as const;

export const getPublicSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    res.json(Object.fromEntries(settings.map(({ key, value }) => [key, value])));
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

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || "today";
    const { start: periodStart, end: periodEnd } = getPeriodRange(period);

    const today = localNow("Asia/Kolkata").date;

    const [
      totalUsers, totalBookings, totalTeams, totalPlayers,
      totalFixtures, revenueLedger, activeBookings, recentFixtures,
      todayFixtures, recentBookings, activity, venues,
      periodBookings, periodLedger, periodCancellations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count({ where: { deletedAt: null } }),
      prisma.team.count({ where: { deletedAt: null } }),
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.fixture.count({ where: { deletedAt: null } }),
      prisma.paymentLedgerEntry.groupBy({ by: ["type"], _sum: { amount: true }, where: { type: { in: ["PAYMENT_CAPTURED", "PAYMENT_REFUNDED"] } } }),
      prisma.booking.count({ where: { status: "CONFIRMED", deletedAt: null } }),
      prisma.fixture.findMany({
        where: { deletedAt: null, status: "SCHEDULED", scheduledDate: { gte: today } },
        take: 5,
        orderBy: [{ scheduledDate: "asc" }, { kickoffAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.fixture.findMany({
        where: { scheduledDate: today, deletedAt: null },
        orderBy: [{ kickoffAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.booking.findMany({
        where: { deletedAt: null },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          turf: { include: { venue: { select: { name: true } } } },
          payments: true,
        },
      }),
      prisma.activityLog.findMany({
        take: 20,
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.venue.findMany({
        where: { deletedAt: null },
        include: { turfs: { where: { isActive: true, deletedAt: null } }, _count: { select: { turfs: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.booking.count({
        where: { date: { gte: periodStart, lte: periodEnd }, deletedAt: null },
      }),
      prisma.paymentLedgerEntry.groupBy({
        by: ["type"],
        _sum: { amount: true },
        where: { createdAt: { gte: periodStart, lte: periodEnd }, type: { in: ["PAYMENT_CAPTURED", "PAYMENT_REFUNDED"] } },
      }),
      prisma.booking.count({
        where: { date: { gte: periodStart, lte: periodEnd }, status: "CANCELLED", deletedAt: null },
      }),
    ]);

    const netRevenue = (rows: typeof revenueLedger) => {
      const captured = rows.find((row) => row.type === "PAYMENT_CAPTURED")?._sum.amount || 0;
      const refunded = rows.find((row) => row.type === "PAYMENT_REFUNDED")?._sum.amount || 0;
      return captured - refunded;
    };

    res.json({
      stats: {
        totalUsers, totalBookings, totalTeams, totalPlayers,
        totalFixtures, totalRevenue: netRevenue(revenueLedger),
        activeBookings,
      },
      periodStats: {
        period,
        bookings: periodBookings,
        revenue: netRevenue(periodLedger),
        cancellations: periodCancellations,
      },
      recentFixtures,
      todayFixtures,
      recentBookings,
      activity,
      venues,
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

export const adminSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ data: [] });
    const role = req.user?.role;
    const canReadBookings = role === "SUPER_ADMIN" || role === "BOOKING_MANAGER";
    const canReadUsers = role === "SUPER_ADMIN";
    const canReadFootball = ["SUPER_ADMIN", "LEAGUE_ADMIN", "STATISTICIAN", "REFEREE", "VIEWER"].includes(role || "");
    const canReadContent = ["SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR", "VIEWER"].includes(role || "");

    const [teams, players, venues, bookings, fixtures, news, sponsors, users] = await Promise.all([
      canReadFootball ? prisma.team.findMany({ where: { name: { contains: q, mode: "insensitive" }, deletedAt: null }, take: 5 }) : Promise.resolve([]),
      canReadFootball ? (async () => {
        const { ids } = await searchPlayerIds(q, { limit: 5 });
        if (ids.length === 0) return [];
        return prisma.player.findMany({
          where: { id: { in: ids }, deletedAt: null },
          include: { team: { select: { name: true } } },
        });
      })() : Promise.resolve([]),
      canReadBookings ? prisma.venue.findMany({ where: { name: { contains: q, mode: "insensitive" }, deletedAt: null }, take: 5 }) : Promise.resolve([]),
      canReadBookings ? prisma.booking.findMany({
        where: { bookingNumber: { contains: q, mode: "insensitive" }, deletedAt: null },
        include: { user: { select: { firstName: true, lastName: true } }, turf: { include: { venue: { select: { name: true } } } } },
        take: 5,
      }) : Promise.resolve([]),
      canReadFootball ? prisma.fixture.findMany({
        where: { deletedAt: null, OR: [{ homeTeam: { name: { contains: q, mode: "insensitive" } } }, { awayTeam: { name: { contains: q, mode: "insensitive" } } }] },
        include: { homeTeam: { select: { shortName: true } }, awayTeam: { select: { shortName: true } } },
        take: 5,
      }) : Promise.resolve([]),
      canReadContent ? prisma.news.findMany({ where: { title: { contains: q, mode: "insensitive" }, deletedAt: null }, take: 5 }) : Promise.resolve([]),
      canReadContent ? prisma.sponsor.findMany({ where: { name: { contains: q, mode: "insensitive" }, deletedAt: null }, take: 5 }) : Promise.resolve([]),
      canReadUsers ? prisma.user.findMany({
        where: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
        take: 5,
      }) : Promise.resolve([]),
    ]);

    const results: any[] = [];
    teams.forEach((t) => results.push({ id: t.id, label: t.name, description: "Team", type: "team" }));
    players.forEach((p) => results.push({ id: p.id, label: `${p.firstName} ${p.lastName}`, description: `Player — ${p.team?.name || "No team"}`, type: "player" }));
    venues.forEach((v) => results.push({ id: v.id, label: v.name, description: "Venue", type: "venue" }));
    bookings.forEach((b) => results.push({ id: b.id, label: `#${b.bookingNumber}`, description: `${b.turf?.venue?.name || "Venue"} — ${b.user?.firstName || ""} ${b.user?.lastName || ""}`, type: "booking" }));
    fixtures.forEach((f) => results.push({ id: f.id, label: `${f.homeTeam?.shortName || "?"} vs ${f.awayTeam?.shortName || "?"}`, description: "Fixture", type: "fixture" }));
    news.forEach((n) => results.push({ id: n.id, label: n.title, description: "News", type: "news" }));
    sponsors.forEach((s) => results.push({ id: s.id, label: s.name, description: "Sponsor", type: "sponsor" }));
    users.forEach((u) => results.push({ id: u.id, label: `${u.firstName} ${u.lastName}`, description: `User — ${u.email}`, type: "user" }));

    res.json({ data: results });
  } catch (error) {
    next(error);
  }
};
