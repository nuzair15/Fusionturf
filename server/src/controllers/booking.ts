import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { paginate, paginatedResponse, generateBookingNumber } from "../utils/helpers";

const createBookingSchema = z.object({
  body: z.object({
    turfId: z.string().uuid(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    duration: z.number().int().min(30).max(180),
    numPlayers: z.number().int().min(1).max(50),
    services: z.array(z.object({ serviceId: z.string().uuid(), quantity: z.number().int().min(1) })).optional(),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const getVenues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { isActive: true };
    if (req.query.city) where.city = { contains: req.query.city, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        include: {
          turfs: { where: { isActive: true } },
          reviews: { select: { rating: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.venue.count({ where }),
    ]);

    const venues = data.map((v) => ({
      ...v,
      avgRating: v.reviews.length
        ? v.reviews.reduce((a, r) => a + r.rating, 0) / v.reviews.length
        : null,
      reviewCount: v.reviews.length,
      reviews: undefined,
    }));

    res.json(paginatedResponse(venues, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getVenueBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { slug: req.params.slug },
      include: {
        turfs: { where: { isActive: true }, include: { services: true } },
        gallery: { where: { isActive: true } },
        reviews: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        workingHours: true,
      },
    });
    if (!venue) throw new AppError("Venue not found", 404);
    res.json(venue);
  } catch (error) {
    next(error);
  }
};

export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turfId, date } = req.query;
    if (!turfId || !date) throw new AppError("turfId and date are required", 400);

    const slots = await prisma.slotAvailability.findMany({
      where: {
        turfId: turfId as string,
        date: new Date(date as string),
        isBooked: false,
      },
      orderBy: { startTime: "asc" },
    });
    res.json(slots);
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBookingSchema.parse(req).body;

    const turf = await prisma.turf.findUnique({ where: { id: data.turfId } });
    if (!turf) throw new AppError("Turf not found", 404);

    let totalAmount = turf.basePrice;
    const matchDate = new Date(data.date);
    const dayOfWeek = matchDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      totalAmount = turf.weekendPrice || turf.basePrice;
    }

    const hour = parseInt(data.startTime.split(":")[0], 10);
    if ((hour >= 17 && hour <= 21)) {
      totalAmount = turf.peakPrice || totalAmount;
    }

    let discountAmount = 0;
    if (data.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: data.couponCode } });
      if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
        if (!coupon.maxUses || coupon.usedCount < coupon.maxUses) {
          discountAmount = coupon.discountType === "PERCENTAGE"
            ? Math.floor(totalAmount * coupon.discountValue / 100)
            : coupon.discountValue;
          await prisma.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }
    }

    const bookingNumber = generateBookingNumber();
    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        userId: req.user!.userId,
        turfId: data.turfId,
        date: matchDate,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        numPlayers: data.numPlayers,
        totalAmount,
        discountAmount,
        couponCode: data.couponCode,
        notes: data.notes,
        status: "PENDING",
        services: data.services
          ? { create: data.services.map((s) => ({ additionalServiceId: s.serviceId, quantity: s.quantity, price: 0 })) }
          : undefined,
      },
      include: { turf: { include: { venue: true } }, services: { include: { additionalService: true } } },
    });

    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { userId: req.user!.userId };
    if (req.query.status) where.status = req.query.status;

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          turf: { include: { venue: { select: { name: true, slug: true } } } },
          payments: { select: { amount: true, status: true, method: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!booking) throw new AppError("Booking not found", 404);
    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      throw new AppError("Booking cannot be cancelled", 400);
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED", cancellationReason: req.body.reason },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─── Admin ───

export const adminGetAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.venueId) where.turf = { venueId: req.query.venueId };

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          turf: { include: { venue: { select: { name: true } } } },
          payments: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const adminBlockDate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueId, date, reason } = req.body;
    const blocked = await prisma.blockedDate.create({
      data: { venueId, date: new Date(date), reason },
    });
    res.status(201).json(blocked);
  } catch (error) {
    next(error);
  }
};

export const adminRevenueAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalBookings, totalRevenue, recentBookings] = await Promise.all([
      prisma.booking.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { turf: { include: { venue: true } }, payments: true },
      }),
    ]);
    res.json({
      totalBookings,
      totalRevenue: totalRevenue._sum.amount || 0,
      recentBookings,
    });
  } catch (error) {
    next(error);
  }
};
