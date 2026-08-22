import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { paginate, paginatedResponse, searchPlayerIds } from "../../utils/helpers.js";
import { pick } from "../../utils/pick.js";
import * as leagueSystem from "../../services/league-system.js";
import { archiveResource } from "../../services/archive.js";

// Venues, turfs, coupons, and advertisements


const VENUE_WRITABLE_FIELDS = [
  "name", "slug", "description", "address", "city", "state", "country", "zipCode",
  "latitude", "longitude", "phone", "email", "coverImage", "logo", "rules", "faqs",
  "isActive", "openingTime", "closingTime", "lastBookingTime", "bookingMessageTemplate",
] as const;

export const getVenues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const where: any = { deletedAt: null };
    if (search) where.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { city: { contains: search as string, mode: "insensitive" } },
    ];
    const venues = await prisma.venue.findMany({
      where,
      include: { turfs: { where: { isActive: true, deletedAt: null } }, _count: { select: { turfs: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ data: venues });
  } catch (error) {
    next(error);
  }
};

export const createVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, VENUE_WRITABLE_FIELDS);
    if (!data.name || !data.slug || !data.address || !data.city || !data.state) {
      throw new AppError("name, slug, address, city, and state are required", 400);
    }
    const venue = await prisma.venue.create({ data });
    res.status(201).json(venue);
  } catch (error) {
    next(error);
  }
};

export const updateVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venue = await prisma.venue.update({ where: { id: req.params.id }, data: pick(req.body, VENUE_WRITABLE_FIELDS) as any });
    res.json(venue);
  } catch (error) {
    next(error);
  }
};

export const deleteVenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await archiveResource({ type: "venue", id: req.params.id, actorId: req.user?.userId, reason: req.body?.reason });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── Turf Management ───

const TURF_WRITABLE_FIELDS = [
  "venueId", "name", "description", "size", "surface", "isActive",
  "basePrice", "peakPrice", "weekendPrice", "halfHourBilling", "imageUrl", "capacity",
] as const;

export const createTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, TURF_WRITABLE_FIELDS);
    if (!data.venueId || !data.name) throw new AppError("venueId and name are required", 400);
    const turf = await prisma.turf.create({ data });
    res.status(201).json(turf);
  } catch (error) {
    next(error);
  }
};

export const updateTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const turf = await prisma.turf.update({ where: { id: req.params.id }, data: pick(req.body, TURF_WRITABLE_FIELDS) as any });
    res.json(turf);
  } catch (error) {
    next(error);
  }
};

export const deleteTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await archiveResource({ type: "turf", id: req.params.id, actorId: req.user?.userId, reason: req.body?.reason });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ─── League System Operations ───

const COUPON_WRITABLE_FIELDS = [
  "code", "discountType", "discountValue", "maxUses", "minAmount", "expiresAt", "isActive",
] as const;
// usedCount is deliberately excluded — it must only ever be incremented by
// the coupon-redemption logic itself, never set directly by an admin request.

export const getCoupons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.coupon.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, COUPON_WRITABLE_FIELDS);
    if (!data.code || !data.discountType || data.discountValue === undefined) {
      throw new AppError("code, discountType, and discountValue are required", 400);
    }
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    const item = await prisma.coupon.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, COUPON_WRITABLE_FIELDS);
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    const item = await prisma.coupon.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await archiveResource({ type: "coupon", id: req.params.id, actorId: req.user?.userId, reason: req.body?.reason });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const AD_WRITABLE_FIELDS = ["title", "imageUrl", "linkUrl", "position", "isActive", "startsAt", "endsAt"] as const;

export const getAdvertisements = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.advertisement.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const createAdvertisement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, AD_WRITABLE_FIELDS);
    if (!data.title || !data.imageUrl) throw new AppError("title and imageUrl are required", 400);
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    const item = await prisma.advertisement.create({ data });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateAdvertisement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = pick(req.body, AD_WRITABLE_FIELDS);
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);
    const item = await prisma.advertisement.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteAdvertisement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await archiveResource({ type: "advertisement", id: req.params.id, actorId: req.user?.userId, reason: req.body?.reason });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
