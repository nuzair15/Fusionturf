import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginate, paginatedResponse, generateBookingNumber } from "../utils/helpers.js";
import bcrypt from "bcryptjs";
import { sendAdminBookingNotification, sendBookingConfirmation } from "../services/email.js";
import { createNotification } from "../services/notification.js";
import { calculateBookingPrice, calculateDiscount, formatThirtyMinuteSlots, timeToMinutes } from "../utils/booking.js";
import { isValidDateOnly, legacyDateOnly, localDateTimeRange, localNow, weekdayForDateOnly } from "../utils/time.js";

const bookingQuoteBase = z.object({
    turfId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD"),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid start time"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid end time"),
    couponCode: z.string().trim().max(50).optional(),
    services: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) })).max(20).optional(),
  });
const validBookingDate = (body: { date: string }, ctx: z.RefinementCtx) => {
    if (!isValidDateOnly(body.date)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "invalid calendar date" });
};
const bookingQuoteSchema = bookingQuoteBase.superRefine(validBookingDate);

const bookingBodySchema = bookingQuoteBase.extend({
  customerName: z.string().trim().min(1).max(200),
  customerPhone: z.string().trim().min(5).max(40),
  customerEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
}).superRefine(validBookingDate);

const createBookingSchema = z.object({ body: bookingBodySchema });

type BookingInput = z.infer<typeof bookingBodySchema>;
type BookingQuoteInput = z.infer<typeof bookingQuoteSchema>;

const isWithinOperatingHours = (startTime: string, endTime: string, openingTime: string, closingTime: string) => {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  const opening = timeToMinutes(openingTime);
  let closing = timeToMinutes(closingTime);
  if (closing <= opening) closing += 24 * 60;
  if (end <= start) end += 24 * 60;
  return start >= opening && end <= closing;
};

async function buildBookingQuote(data: BookingQuoteInput, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const turf = await db.turf.findFirst({
    where: { id: data.turfId, isActive: true, deletedAt: null, venue: { is: { isActive: true, deletedAt: null } } },
    include: { venue: { include: { workingHours: true } } },
  });
  if (!turf) throw new AppError("Turf is inactive or unavailable", 404);

  const timezone = turf.venue.timezone || "Asia/Kolkata";
  const { startAt, endAt, durationMinutes } = localDateTimeRange(data.date, data.startTime, data.endTime, timezone);
  if (startAt <= new Date()) throw new AppError("Booking time must be in the future", 400);
  if (durationMinutes % 30 !== 0) throw new AppError("Booking duration must use 30-minute increments", 400);

  const blocked = await db.blockedDate.findFirst({ where: { venueId: turf.venueId, date: legacyDateOnly(data.date) } });
  if (blocked) throw new AppError(`This date is blocked: ${blocked.reason || "No reason given"}`, 400);

  const weekday = weekdayForDateOnly(data.date, timezone);
  const hours = turf.venue.workingHours.find((entry) => entry.dayOfWeek === weekday);
  if (hours?.isClosed) throw new AppError("The venue is closed on this day", 400);
  const openingTime = hours?.openTime || turf.venue.openingTime;
  const closingTime = hours?.closeTime || turf.venue.closingTime;
  const latestStart = turf.venue.lastBookingTime || closingTime;
  const openingMinutes = timeToMinutes(openingTime);
  let latestStartMinutes = timeToMinutes(latestStart);
  let requestedStartMinutes = timeToMinutes(data.startTime);
  if (latestStartMinutes <= openingMinutes) latestStartMinutes += 24 * 60;
  if (requestedStartMinutes < openingMinutes) requestedStartMinutes += 24 * 60;
  if (!isWithinOperatingHours(data.startTime, data.endTime, openingTime, closingTime) || requestedStartMinutes > latestStartMinutes) {
    throw new AppError("Selected time is outside the venue booking hours", 400);
  }

  const priceOverride = await db.pricingOverride.findUnique({
    where: { venueId_date: { venueId: turf.venueId, date: legacyDateOnly(data.date) } },
  });
  const pricedTurf = priceOverride
    ? { ...turf, basePrice: priceOverride.price, peakPrice: priceOverride.price, weekendPrice: priceOverride.price }
    : turf;
  const basePricing = calculateBookingPrice(pricedTurf, legacyDateOnly(data.date), data.startTime, data.endTime);

  const requestedServices = data.services || [];
  const serviceIds = [...new Set(requestedServices.map((service) => service.id))];
  const services = serviceIds.length
    ? await db.additionalService.findMany({ where: { id: { in: serviceIds }, turfId: turf.id, isActive: true, deletedAt: null } })
    : [];
  if (services.length !== serviceIds.length) throw new AppError("One or more additional services are unavailable", 400);
  const serviceLines = requestedServices.map((requested) => {
    const service = services.find((candidate) => candidate.id === requested.id)!;
    return { id: service.id, name: service.name, quantity: requested.quantity, unitPrice: service.price, total: service.price * requested.quantity };
  });
  const servicesTotal = serviceLines.reduce((total, service) => total + service.total, 0);
  const grossAmount = basePricing.totalAmount + servicesTotal;

  let coupon: Awaited<ReturnType<typeof db.coupon.findFirst>> = null;
  let discountAmount = 0;
  if (data.couponCode) {
    coupon = await db.coupon.findFirst({ where: { code: data.couponCode.trim().toUpperCase(), isActive: true, deletedAt: null } });
    if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date()) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) {
      throw new AppError("Invalid or expired coupon code", 400);
    }
    if (coupon.minAmount !== null && grossAmount < coupon.minAmount) throw new AppError(`Minimum booking amount for this coupon is ${coupon.minAmount / 100}`, 400);
    discountAmount = calculateDiscount(coupon.discountType, coupon.discountValue, grossAmount);
  }

  return {
    turf,
    coupon,
    startAt,
    endAt,
    duration: durationMinutes,
    baseAmount: basePricing.totalAmount,
    hourlyPrice: basePricing.hourlyPrice,
    serviceLines,
    servicesTotal,
    discountAmount,
    totalAmount: grossAmount - discountAmount,
    currency: "INR",
    timezone,
    priceOverride: priceOverride ? { price: priceOverride.price, reason: priceOverride.reason } : null,
  };
}

async function releaseCouponOnce(tx: Prisma.TransactionClient, bookingId: string) {
  const redemption = await tx.couponRedemption.findFirst({ where: { bookingId, releasedAt: null } });
  if (!redemption) return false;
  const released = await tx.couponRedemption.updateMany({
    where: { id: redemption.id, releasedAt: null },
    data: { releasedAt: new Date() },
  });
  if (released.count !== 1) return false;
  await tx.coupon.updateMany({
    where: { id: redemption.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
  return true;
}

export const getBookingQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = bookingQuoteSchema.parse(req.body);
    const quote = await buildBookingQuote(data);
    res.json({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      startAt: quote.startAt,
      endAt: quote.endAt,
      duration: quote.duration,
      baseAmount: quote.baseAmount,
      services: quote.serviceLines,
      servicesTotal: quote.servicesTotal,
      discountAmount: quote.discountAmount,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      timezone: quote.timezone,
      priceOverride: quote.priceOverride,
    });
  } catch (error) {
    next(error);
  }
};

function guestTokenHash(req: Request) {
  const token = req.get("X-Guest-Token")?.trim();
  if (!token || token.length > 256) throw new AppError("A valid guest management token is required", 401);
  return createHash("sha256").update(token).digest("hex");
}

export const getGuestBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { guestTokenHash: guestTokenHash(req), guestTokenExpiresAt: { gt: new Date() }, deletedAt: null },
      include: { turf: { include: { venue: true } }, payments: { select: { status: true, amount: true, currency: true } }, bookingServices: { include: { additionalService: true } } },
    });
    if (!booking) throw new AppError("This guest booking link is invalid or has expired", 404);
    res.json(booking);
  } catch (error) { next(error); }
};

export const cancelGuestBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenHash = guestTokenHash(req);
    const updated = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { guestTokenHash: tokenHash, guestTokenExpiresAt: { gt: new Date() }, deletedAt: null } });
      if (!booking) throw new AppError("This guest booking link is invalid or has expired", 404);
      if (booking.status === "CANCELLED") return booking;
      if (!["PENDING", "CONFIRMED", "RESCHEDULED"].includes(booking.status)) throw new AppError("Booking cannot be cancelled", 409);
      const changed = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: "CANCELLED", blocksAvailability: false, cancellationReason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : "Cancelled through guest management link" },
      });
      if (changed.count !== 1) throw new AppError("Booking changed concurrently; retry the request", 409);
      await releaseCouponOnce(tx, booking.id);
      await tx.outboxEvent.create({
        data: { aggregateType: "BOOKING", aggregateId: booking.id, eventType: "BOOKING_CANCELLED", payload: { bookingId: booking.id, source: "guest-link" }, idempotencyKey: `booking:${booking.id}:cancelled` },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { turf: { include: { venue: true } }, payments: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json(updated);
  } catch (error) { next(error); }
};

export const getVenues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { isActive: true, deletedAt: null };
    if (req.query.city) where.city = { contains: req.query.city, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        include: {
          turfs: { where: { isActive: true, deletedAt: null } },
          reviews: { where: { deletedAt: null, isApproved: true }, select: { rating: true } },
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
    const venue = await prisma.venue.findFirst({
      where: { slug: req.params.slug, isActive: true, deletedAt: null },
      include: {
        turfs: { where: { isActive: true, deletedAt: null }, include: { services: { where: { isActive: true, deletedAt: null } } } },
        gallery: { where: { isActive: true } },
        reviews: {
          where: { deletedAt: null, isApproved: true }, include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
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
    if (typeof turfId !== "string" || typeof date !== "string" || !isValidDateOnly(date)) throw new AppError("turfId and a valid YYYY-MM-DD date are required", 400);

    const turf = await prisma.turf.findFirst({
      where: { id: turfId, isActive: true, deletedAt: null, venue: { is: { isActive: true, deletedAt: null } } },
      include: { venue: { include: { workingHours: true } } },
    });
    if (!turf) throw new AppError("Turf not found", 404);
    const blocked = await prisma.blockedDate.findFirst({ where: { venueId: turf.venueId, date: legacyDateOnly(date) } });
    if (blocked) {
      res.json([]);
      return;
    }
    const timezone = turf.venue.timezone || "Asia/Kolkata";
    const today = localNow(timezone);
    if (date < today.date) {
      res.json([]);
      return;
    }
    const workingHours = turf.venue.workingHours.find((entry) => entry.dayOfWeek === weekdayForDateOnly(date, timezone));
    if (workingHours?.isClosed) {
      res.json([]);
      return;
    }
    const openingTime = workingHours?.openTime || turf.venue.openingTime;
    const closingTime = workingHours?.closeTime || turf.venue.closingTime;
    const bookings = await prisma.booking.findMany({
      where: { turfId: turf.id, date: legacyDateOnly(date), deletedAt: null, blocksAvailability: true },
      select: { startAt: true, endAt: true, startTime: true, endTime: true },
    });
    const slots = formatThirtyMinuteSlots(openingTime, closingTime).map((startTime) => {
      const endMinutes = (timeToMinutes(startTime) + 30) % (24 * 60);
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      const interval = localDateTimeRange(date, startTime, endTime, timezone);
      const isBooked = bookings.some((booking) => booking.startAt && booking.endAt
        ? interval.startAt < booking.endAt && booking.startAt < interval.endAt
        : startTime < booking.endTime && booking.startTime < endTime);
      return { turfId: turf.id, date, startTime, endTime, startAt: interval.startAt, endAt: interval.endAt, isBooked };
    });
    res.json(slots.filter((slot) => !slot.isBooked && slot.startAt > new Date()));
  } catch (error) {
    next(error);
  }
};

export const getBookedSlotsForTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turfId } = req.params;
    const { date } = req.query;
    if (typeof date !== "string" || !isValidDateOnly(date)) throw new AppError("a valid YYYY-MM-DD date query param is required", 400);
    const matchDate = legacyDateOnly(date);
    const bookings = await prisma.booking.findMany({
      where: {
        turfId,
        date: matchDate,
        deletedAt: null,
        blocksAvailability: true,
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, turfId, date, startTime, endTime } = req.body;
    if (!code || !turfId || !date || !startTime || !endTime) throw new AppError("code, turfId, date, startTime and endTime are required", 400);
    const turf = await prisma.turf.findFirst({ where: { id: turfId, deletedAt: null } });
    const coupon = await prisma.coupon.findFirst({ where: { code: String(code).trim().toUpperCase(), deletedAt: null } });
    if (!turf || !coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date()) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) throw new AppError("Invalid or expired coupon code", 400);
    let pricing;
    try { pricing = calculateBookingPrice(turf, new Date(date), startTime, endTime); }
    catch (error: any) { throw new AppError(error.message, 400); }
    if (coupon.minAmount !== null && pricing.totalAmount < coupon.minAmount) throw new AppError(`Minimum booking amount for this coupon is ${coupon.minAmount / 100}`, 400);
    const discountAmount = calculateDiscount(coupon.discountType, coupon.discountValue, pricing.totalAmount);
    res.json({ code: coupon.code, discountAmount, totalAmount: pricing.totalAmount - discountAmount });
  } catch (error) { next(error); }
};

const createBookingLegacy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBookingSchema.parse(req).body;

    const turf = await prisma.turf.findFirst({ where: { id: data.turfId, deletedAt: null, venue: { is: { deletedAt: null } } }, include: { venue: true } });
    if (!turf) throw new AppError("Turf not found", 404);

    const matchDate = new Date(data.date);

    // Check if date is blocked
    if (turf.venue) {
      const blocked = await prisma.blockedDate.findFirst({
        where: { venueId: turf.venue.id, date: matchDate },
      });
      if (blocked) throw new AppError(`This date is blocked: ${blocked.reason || "No reason given"}`, 400);
    }

    let pricing;
    try { pricing = calculateBookingPrice(turf, matchDate, data.startTime, data.endTime); }
    catch (error: any) { throw new AppError(error.message, 400); }
    const duration = pricing.duration;
    const latestStart = turf.venue.lastBookingTime || turf.venue.closingTime;
    if (timeToMinutes(data.startTime) < timeToMinutes(turf.venue.openingTime) || timeToMinutes(data.endTime) > timeToMinutes(turf.venue.closingTime) || timeToMinutes(data.startTime) > timeToMinutes(latestStart)) {
      throw new AppError("Selected time is outside the venue booking hours", 400);
    }

    // Authenticated customers always own their own booking. For an anonymous
    // booking, use an internal unique guest address rather than looking up the
    // submitted email: otherwise anyone could attach a booking to an existing
    // account merely by knowing its address.
    //
    // Create a non-loginable guest identity. IMPORTANT: this must
    // never use a predictable/shared password. An earlier version hashed the
    // literal string "guest" here, which meant anyone who knew (or guessed)
    // a real person's email could book as a guest using that email and then
    // log in as them with password "guest" — full account takeover. A random
    // password means the account is created but simply isn't loginable
    // until the owner goes through a real password-reset flow.
    let guest;
    if (req.user) {
      guest = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!guest) throw new AppError("Authentication required", 401);
    } else {
      const guestEmail = `guest-${randomBytes(16).toString("hex")}@guest.fusionturf.internal`;
      const randomPassword = randomBytes(32).toString("hex");
      const hashed = await bcrypt.hash(randomPassword, 10);
      guest = await prisma.user.create({
        data: {
          email: guestEmail,
          passwordHash: hashed,
          firstName: data.customerName.split(" ")[0] || "Guest",
          lastName: data.customerName.split(" ").slice(1).join(" ") || "User",
          role: "CUSTOMER",
          phone: data.customerPhone,
          emailVerified: false,
        },
      });
    }

    // The overlap check and the insert must be atomic. Previously these were
    // two separate round-trips with no transaction and no DB-level guarantee,
    // so two requests for the same turf/time arriving close together could
    // both pass the overlap check before either had committed — double-
    // booking the slot. SERIALIZABLE isolation makes Postgres detect that
    // conflict and abort one of the transactions (P2034), which we retry a
    // few times before surfacing a real 409 to the loser.
    // The sequential booking number is generated inside the loop: concurrent
    // requests could observe the same count and pick the same sequence, so a
    // unique-constraint hit (P2002) triggers a retry with a fresh number.
    let booking;
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const bookingNumber = await generateBookingNumber();
        booking = await prisma.$transaction(async (tx) => {
          const overlap = await tx.booking.findFirst({
            where: {
              turfId: data.turfId,
              date: matchDate,
              status: { not: "CANCELLED" },
              startTime: { lt: data.endTime },
              endTime: { gt: data.startTime },
            },
          });
          if (overlap) throw new AppError("This time slot is already booked. Please choose a different time.", 409);

          let discountAmount = 0;
          if (data.couponCode) {
            const coupon = await tx.coupon.findUnique({ where: { code: data.couponCode.toUpperCase() } });
            if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date()) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) throw new AppError("Invalid or expired coupon code", 400);
            if (coupon.minAmount !== null && pricing.totalAmount < coupon.minAmount) throw new AppError(`Minimum booking amount for this coupon is ${coupon.minAmount / 100}`, 400);
            discountAmount = calculateDiscount(coupon.discountType, coupon.discountValue, pricing.totalAmount);
            const claimed = await tx.coupon.updateMany({ where: { id: coupon.id, isActive: true, OR: [{ maxUses: null }, { usedCount: { lt: coupon.maxUses! } }] }, data: { usedCount: { increment: 1 } } });
            if (claimed.count !== 1) throw new AppError("Coupon is no longer available", 409);
          }
          const totalAmount = pricing.totalAmount - discountAmount;

          return tx.booking.create({
            data: {
              bookingNumber,
              userId: guest!.id,
              turfId: data.turfId,
              date: matchDate,
              startTime: data.startTime,
              endTime: data.endTime,
              duration,
              totalAmount,
              discountAmount,
              couponCode: data.couponCode ? data.couponCode.toUpperCase() : null,
              customerEmail: data.customerEmail || null,
              notes: data.notes || null,
              status: "PENDING",
              payments: {
                create: {
                  userId: guest!.id,
                  amount: totalAmount,
                  currency: "INR",
                  status: "PENDING",
                },
              },
            },
            include: { turf: { include: { venue: true } }, user: { select: { firstName: true, lastName: true, email: true, phone: true } }, payments: true },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (err: any) {
        const isSerializationConflict = err?.code === "P2034";
        const isDuplicateBookingNumber = err?.code === "P2002" && Array.isArray(err?.meta?.target) && err.meta.target.includes("bookingNumber");
        if ((isSerializationConflict || isDuplicateBookingNumber) && attempt < maxAttempts) continue;
        throw err;
      }
    }

    res.status(201).json(booking);

    // Send confirmation email (non-blocking)
    const confirmationEmail = data.customerEmail || (req.user ? guest.email : undefined);
    if (confirmationEmail) sendBookingConfirmation(confirmationEmail, booking).catch(() => {});
    sendAdminBookingNotification(booking).catch((error) => console.error("Failed to send booking admin notification:", error));
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBookingSchema.parse(req).body;
    const suppliedKey = req.header("Idempotency-Key")?.trim();
    if (suppliedKey && suppliedKey.length > 128) throw new AppError("Idempotency-Key must be at most 128 characters", 400);
    const idempotencyKey = suppliedKey || `legacy:${randomBytes(24).toString("hex")}`;
    res.setHeader("Idempotency-Key", idempotencyKey);

    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      include: {
        turf: { include: { venue: true } },
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        payments: true,
        bookingServices: { include: { additionalService: true } },
      },
    });
    if (existing) {
      res.status(200).json({ booking: existing, idempotentReplay: true });
      return;
    }

    const userId = req.user?.userId || null;
    if (userId && !(await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } }))) {
      throw new AppError("Authentication required", 401);
    }
    const guestManagementToken = userId ? null : randomBytes(32).toString("base64url");
    const guestTokenHash = guestManagementToken ? createHash("sha256").update(guestManagementToken).digest("hex") : null;
    await buildBookingQuote(data);

    let booking: any;
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const bookingNumber = await generateBookingNumber();
        booking = await prisma.$transaction(async (tx) => {
          const quote = await buildBookingQuote(data, tx);
          const overlap = await tx.booking.findFirst({
            where: {
              turfId: data.turfId,
              deletedAt: null,
              blocksAvailability: true,
              startAt: { lt: quote.endAt },
              endAt: { gt: quote.startAt },
            },
          });
          if (overlap) throw new AppError("This time slot is already booked. Please choose a different time.", 409);

          if (quote.coupon) {
            const claimed = await tx.coupon.updateMany({
              where: {
                id: quote.coupon.id,
                isActive: true,
                deletedAt: null,
                OR: [{ maxUses: null }, { usedCount: { lt: quote.coupon.maxUses! } }],
              },
              data: { usedCount: { increment: 1 } },
            });
            if (claimed.count !== 1) throw new AppError("Coupon is no longer available", 409);
          }

          const created = await tx.booking.create({
            data: {
              bookingNumber,
              userId,
              turfId: data.turfId,
              date: legacyDateOnly(data.date),
              startTime: data.startTime,
              endTime: data.endTime,
              startAt: quote.startAt,
              endAt: quote.endAt,
              duration: quote.duration,
              totalAmount: quote.totalAmount,
              discountAmount: quote.discountAmount,
              couponCode: quote.coupon?.code || null,
              customerName: data.customerName,
              customerPhone: data.customerPhone,
              customerEmail: data.customerEmail || null,
              idempotencyKey,
              guestTokenHash,
              guestTokenExpiresAt: guestTokenHash ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
              quoteSnapshot: {
                quotedAt: new Date().toISOString(),
                timezone: quote.timezone,
                currency: quote.currency,
                baseAmount: quote.baseAmount,
                servicesTotal: quote.servicesTotal,
                discountAmount: quote.discountAmount,
                totalAmount: quote.totalAmount,
                priceOverride: quote.priceOverride,
              },
              blocksAvailability: true,
              notes: data.notes || null,
              status: "PENDING",
              payments: { create: { userId, amount: quote.totalAmount, currency: quote.currency, status: "PENDING" } },
              bookingServices: quote.serviceLines.length ? {
                create: quote.serviceLines.map((service) => ({
                  additionalServiceId: service.id,
                  quantity: service.quantity,
                  price: service.unitPrice,
                })),
              } : undefined,
            },
            include: {
              turf: { include: { venue: true } },
              user: { select: { firstName: true, lastName: true, email: true, phone: true } },
              payments: true,
              bookingServices: { include: { additionalService: true } },
            },
          });

          if (quote.coupon) {
            await tx.couponRedemption.create({
              data: {
                couponId: quote.coupon.id,
                bookingId: created.id,
                discountAmount: quote.discountAmount,
                idempotencyKey: `booking:${created.id}:coupon:${quote.coupon.id}`,
              },
            });
          }
          await tx.outboxEvent.createMany({
            data: [
              {
                aggregateType: "BOOKING",
                aggregateId: created.id,
                eventType: "BOOKING_CREATED_CUSTOMER_EMAIL",
                payload: { bookingId: created.id, email: data.customerEmail || null },
                idempotencyKey: `booking:${created.id}:customer-created-email`,
              },
              {
                aggregateType: "BOOKING",
                aggregateId: created.id,
                eventType: "BOOKING_CREATED_ADMIN_EMAIL",
                payload: { bookingId: created.id },
                idempotencyKey: `booking:${created.id}:admin-created-email`,
              },
            ],
          });
          return created;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (err: any) {
        const targets = Array.isArray(err?.meta?.target) ? err.meta.target : [];
        const retryable = err?.code === "P2034" || (err?.code === "P2002" && targets.includes("bookingNumber"));
        if (retryable && attempt < maxAttempts) continue;
        if (err?.code === "P2002" && targets.includes("idempotencyKey")) {
          const replay = await prisma.booking.findUnique({ where: { idempotencyKey }, include: { turf: { include: { venue: true } }, payments: true } });
          if (replay) {
            res.status(200).json({ booking: replay, idempotentReplay: true });
            return;
          }
        }
        if (err?.code === "P2004" || String(err?.message || "").includes("bookings_no_active_overlap")) {
          throw new AppError("This time slot is already booked. Please choose a different time.", 409);
        }
        throw err;
      }
    }

    if (!booking) throw new AppError("Booking could not be created", 409);
    res.status(201).json({ booking, guestManagementToken, idempotencyKey });
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { userId: req.user!.userId, deletedAt: null };
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
    const updated = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: req.params.id, userId: req.user!.userId, deletedAt: null },
      });
      if (!booking) throw new AppError("Booking not found", 404);
      if (booking.status === "CANCELLED") return booking;
      if (booking.status !== "PENDING" && booking.status !== "CONFIRMED" && booking.status !== "RESCHEDULED") {
        throw new AppError("Booking cannot be cancelled", 400);
      }
      const changed = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: "CANCELLED", blocksAvailability: false, cancellationReason: req.body.reason || "Cancelled by customer" },
      });
      if (changed.count !== 1) throw new AppError("Booking changed while it was being cancelled; retry the request", 409);
      await releaseCouponOnce(tx, booking.id);
      await tx.outboxEvent.create({
        data: {
          aggregateType: "BOOKING",
          aggregateId: booking.id,
          eventType: "BOOKING_CANCELLED",
          payload: { bookingId: booking.id, reason: req.body.reason || null },
          idempotencyKey: `booking:${booking.id}:cancelled`,
        },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─── Admin ───

export const adminUpdateBookingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"].includes(status)) {
      throw new AppError("Invalid status", 400);
    }
    const transitions: Record<string, string[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["COMPLETED", "CANCELLED"],
      RESCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED"],
      CANCELLED: [],
      COMPLETED: [],
    };
    const updated = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { status: true, userId: true, bookingNumber: true, id: true } });
      if (!booking) throw new AppError("Booking not found", 404);
      if (status === booking.status) return { ...booking, statusChanged: false };
      if (!transitions[booking.status]?.includes(status)) throw new AppError(`Cannot move a booking from ${booking.status} to ${status}`, 409);
      const changed = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status, blocksAvailability: status === "PENDING" || status === "CONFIRMED" || status === "RESCHEDULED" },
      });
      if (changed.count !== 1) throw new AppError("Booking changed concurrently; retry the request", 409);
      if (status === "CANCELLED") await releaseCouponOnce(tx, booking.id);
      await tx.outboxEvent.create({
        data: {
          aggregateType: "BOOKING",
          aggregateId: booking.id,
          eventType: "BOOKING_STATUS_CHANGED",
          payload: { bookingId: booking.id, from: booking.status, to: status },
          idempotencyKey: `booking:${booking.id}:status:${booking.status}:${status}`,
        },
      });
      return { ...booking, status, statusChanged: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (updated.statusChanged) {
      if (updated.userId) createNotification(
        updated.userId,
        "Booking status updated",
        `Your booking ${updated.bookingNumber} is now ${status.toLowerCase()}.`,
        "booking"
      ).catch(() => {});
    }
    const { statusChanged: _statusChanged, ...response } = updated;
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const adminMarkBookingPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { method } = req.body;
    const validMethods = ["CASH", "UPI", "CARD", "NETBANKING", "WALLET"];
    if (method && !validMethods.includes(method)) {
      throw new AppError("Invalid payment method", 400);
    }
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, status: true } });
      if (!booking) throw new AppError("Booking not found", 404);
      if (booking.status === "CANCELLED") throw new AppError("Cancelled bookings cannot be marked paid", 400);
      const pending = await tx.payment.findMany({ where: { bookingId: booking.id, status: "PENDING" } });
      const capturedAt = new Date();
      for (const payment of pending) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", capturedAt, ...(method ? { method } : {}) },
        });
        await tx.paymentLedgerEntry.create({
          data: {
            bookingId: booking.id,
            paymentId: payment.id,
            type: "PAYMENT_CAPTURED",
            amount: payment.amount,
            currency: payment.currency,
            idempotencyKey: `payment:${payment.id}:capture`,
            metadata: { method: method || payment.method || null },
            createdById: req.user?.userId || null,
          },
        });
      }
      if (booking.status === "PENDING" || booking.status === "RESCHEDULED") {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", blocksAvailability: true } });
      }
      return { count: pending.length, status: booking.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED" };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adminRefundBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, status: true } });
      if (!booking) throw new AppError("Booking not found", 404);
      const refundable = await tx.payment.findMany({ where: { bookingId: booking.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
      const refundedAt = new Date();
      let refundedAmount = 0;
      for (const payment of refundable) {
        const amount = Math.max(0, payment.amount - payment.refundAmount);
        if (amount === 0) continue;
        await tx.paymentLedgerEntry.create({
          data: {
            bookingId: booking.id,
            paymentId: payment.id,
            type: "PAYMENT_REFUNDED",
            amount,
            currency: payment.currency,
            idempotencyKey: `payment:${payment.id}:refund:full`,
            metadata: { reason: req.body.reason || "Admin refund" },
            createdById: req.user?.userId || null,
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED", refundAmount: payment.amount, refundReason: req.body.reason || "Admin refund", refundedAt },
        });
        refundedAmount += amount;
      }
      await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
      if (booking.status !== "CANCELLED") {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", blocksAvailability: false, cancellationReason: "Payment refunded" } });
      }
      await releaseCouponOnce(tx, booking.id);
      return { count: refundable.length, refundedAmount, status: "CANCELLED" };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateBookingDiscount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { discountAmount } = req.body;
    if (typeof discountAmount !== "number" || !Number.isFinite(discountAmount) || discountAmount < 0) {
      throw new AppError("discountAmount (in paise) must be a non-negative number", 400);
    }
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      select: { id: true, totalAmount: true, discountAmount: true, payments: { select: { status: true } } },
    });
    if (!booking) throw new AppError("Booking not found", 404);
    if (booking.payments.some((payment) => payment.status === "PAID" || payment.status === "PARTIALLY_REFUNDED" || payment.status === "REFUNDED")) {
      throw new AppError("A settled booking cannot be repriced; create an accounting adjustment instead", 409);
    }

    // totalAmount is already net of the currently applied discount.
    const gross = Math.max(0, booking.totalAmount + (booking.discountAmount || 0));
    const discount = Math.min(discountAmount, gross);
    const newTotal = gross - discount;

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { discountAmount: discount, totalAmount: newTotal } }),
      prisma.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { amount: newTotal } }),
    ]);

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const adminUpdateBookingLegacy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, startTime, endTime } = req.body;
    if (date !== undefined && (typeof date !== "string" || !isValidDateOnly(date))) throw new AppError("date must be a valid YYYY-MM-DD date", 400);
    if (startTime !== undefined && (typeof startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))) throw new AppError("startTime must use HH:MM", 400);
    if (endTime !== undefined && (typeof endTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))) throw new AppError("endTime must use HH:MM", 400);
    const current = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { turf: { include: { venue: true } } }, });
    if (!current) throw new AppError("Booking not found", 404);
    if (current.status === "CANCELLED" || current.status === "COMPLETED") {
      throw new AppError("Cancelled or completed bookings cannot be rescheduled", 400);
    }
    const nextDate = date ? new Date(`${date}T00:00:00Z`) : current.date;
    if (Number.isNaN(nextDate.getTime())) throw new AppError("Invalid booking date", 400);
    const nextStart = startTime || current.startTime;
    const nextEnd = endTime || current.endTime;
    if (nextStart >= nextEnd) throw new AppError("endTime must be after startTime", 400);
    let pricing;
    try { pricing = calculateBookingPrice(current.turf, nextDate, nextStart, nextEnd); }
    catch (error: any) { throw new AppError(error.message, 400); }
    const latestStart = current.turf.venue.lastBookingTime || current.turf.venue.closingTime;
    if (timeToMinutes(nextStart) < timeToMinutes(current.turf.venue.openingTime) || timeToMinutes(nextEnd) > timeToMinutes(current.turf.venue.closingTime) || timeToMinutes(nextStart) > timeToMinutes(latestStart)) throw new AppError("Selected time is outside the venue booking hours", 400);
    const updateData: any = { date: nextDate, startTime: nextStart, endTime: nextEnd, duration: pricing.duration };
    const overlap = await prisma.booking.findFirst({ where: { id: { not: current.id }, turfId: current.turfId, date: nextDate, status: { not: "CANCELLED" }, startTime: { lt: nextEnd }, endTime: { gt: nextStart } } });
    if (overlap) throw new AppError("This time slot is already booked. Please choose a different time.", 409);
    const discount = Math.min(current.discountAmount || 0, pricing.totalAmount);
    updateData.totalAmount = pricing.totalAmount - discount;
    const [booking] = await prisma.$transaction([
      prisma.booking.update({ where: { id: req.params.id }, data: updateData }),
      prisma.payment.updateMany({ where: { bookingId: req.params.id, status: "PENDING" }, data: { amount: updateData.totalAmount } }),
    ]);
    if (nextDate.getTime() !== current.date.getTime() || nextStart !== current.startTime || nextEnd !== current.endTime) {
      if (current.userId) createNotification(current.userId, "Booking time updated", `Your booking ${current.bookingNumber} has been moved to ${nextDate.toISOString().slice(0, 10)} from ${nextStart} to ${nextEnd}.`, "booking").catch(() => {});
    }
    res.json(booking);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, startTime, endTime } = req.body;
    if (date !== undefined && (typeof date !== "string" || !isValidDateOnly(date))) throw new AppError("date must be a valid YYYY-MM-DD date", 400);
    if (startTime !== undefined && (typeof startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))) throw new AppError("startTime must use HH:MM", 400);
    if (endTime !== undefined && (typeof endTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))) throw new AppError("endTime must use HH:MM", 400);

    const current = await prisma.booking.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { turf: { include: { venue: true } }, bookingServices: true },
    });
    if (!current) throw new AppError("Booking not found", 404);
    if (current.status === "CANCELLED" || current.status === "COMPLETED") throw new AppError("Cancelled or completed bookings cannot be rescheduled", 400);

    const nextDate = typeof date === "string" ? date : current.date.toISOString().slice(0, 10);
    const nextStart = typeof startTime === "string" ? startTime : current.startTime;
    const nextEnd = typeof endTime === "string" ? endTime : current.endTime;
    const quoteInput: BookingInput = {
      turfId: current.turfId,
      date: nextDate,
      startTime: nextStart,
      endTime: nextEnd,
      customerName: current.customerName || "Booking customer",
      customerPhone: current.customerPhone || "Not provided",
      customerEmail: current.customerEmail || "",
      services: current.bookingServices.map((service) => ({ id: service.additionalServiceId, quantity: service.quantity })),
    };

    const booking = await prisma.$transaction(async (tx) => {
      const quote = await buildBookingQuote(quoteInput, tx);
      const overlap = await tx.booking.findFirst({
        where: {
          id: { not: current.id },
          turfId: current.turfId,
          deletedAt: null,
          blocksAvailability: true,
          startAt: { lt: quote.endAt },
          endAt: { gt: quote.startAt },
        },
      });
      if (overlap) throw new AppError("This time slot is already booked. Please choose a different time.", 409);
      const discount = Math.min(current.discountAmount || 0, quote.totalAmount);
      const totalAmount = quote.totalAmount - discount;
      const changed = await tx.booking.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: {
          date: legacyDateOnly(nextDate),
          startTime: nextStart,
          endTime: nextEnd,
          startAt: quote.startAt,
          endAt: quote.endAt,
          duration: quote.duration,
          totalAmount,
          status: "RESCHEDULED",
          blocksAvailability: true,
        },
      });
      if (changed.count !== 1) throw new AppError("Booking changed concurrently; retry the request", 409);
      await tx.payment.updateMany({ where: { bookingId: current.id, status: "PENDING" }, data: { amount: totalAmount } });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "BOOKING",
          aggregateId: current.id,
          eventType: "BOOKING_RESCHEDULED",
          payload: { bookingId: current.id, date: nextDate, startTime: nextStart, endTime: nextEnd },
          idempotencyKey: `booking:${current.id}:reschedule:${quote.startAt.toISOString()}:${quote.endAt.toISOString()}`,
        },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: current.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (current.userId) {
      createNotification(current.userId, "Booking time updated", `Your booking ${current.bookingNumber} has been moved to ${nextDate} from ${nextStart} to ${nextEnd}.`, "booking").catch(() => {});
    }
    res.json(booking);
  } catch (error: any) {
    if (error?.code === "P2004" || String(error?.message || "").includes("bookings_no_active_overlap")) {
      next(new AppError("This time slot is already booked. Please choose a different time.", 409));
      return;
    }
    next(error);
  }
};

export const adminGetAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = { deletedAt: null };
    if (req.query.status) where.status = req.query.status;
    if (req.query.venueId) where.turf = { venueId: req.query.venueId };
    if (req.query.search) {
      const s = req.query.search as string;
      where.OR = [
        { bookingNumber: { contains: s, mode: "insensitive" } },
        { user: { firstName: { contains: s, mode: "insensitive" } } },
        { user: { lastName: { contains: s, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          turf: { include: { venue: { select: { name: true, bookingMessageTemplate: true, lastBookingTime: true } } } },
          payments: true,
          bookingServices: { include: { additionalService: { select: { id: true, name: true, price: true } } } },
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
    if (typeof venueId !== "string" || !venueId || typeof date !== "string" || !isValidDateOnly(date)) {
      throw new AppError("venueId and a valid YYYY-MM-DD date are required", 400);
    }
    if (reason !== undefined && typeof reason !== "string") throw new AppError("reason must be a string", 400);
    const blocked = await prisma.blockedDate.create({
      data: { venueId, date: new Date(`${date}T00:00:00Z`), reason },
    });
    res.status(201).json(blocked);
  } catch (error) {
    next(error);
  }
};

export const adminRevenueAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalBookings, captured, refunded, recentBookings] = await Promise.all([
      prisma.booking.count({ where: { deletedAt: null } }),
      prisma.paymentLedgerEntry.aggregate({ _sum: { amount: true }, where: { type: "PAYMENT_CAPTURED" } }),
      prisma.paymentLedgerEntry.aggregate({ _sum: { amount: true }, where: { type: "PAYMENT_REFUNDED" } }),
      prisma.booking.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { turf: { include: { venue: true } }, payments: true },
      }),
    ]);
    res.json({
      totalBookings,
      capturedRevenue: captured._sum.amount || 0,
      refundedRevenue: refunded._sum.amount || 0,
      totalRevenue: (captured._sum.amount || 0) - (refunded._sum.amount || 0),
      recentBookings,
    });
  } catch (error) {
    next(error);
  }
};

export const getCalendarBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueId, month, year } = req.query;
    const monthNumber = typeof month === "string" ? Number(month) : NaN;
    const yearNumber = typeof year === "string" ? Number(year) : NaN;
    if (typeof venueId !== "string" || !venueId || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
      throw new AppError("venueId, a month (1-12), and a valid year are required", 400);
    }

    const startDate = new Date(yearNumber, monthNumber - 1, 1);
    const endDate = new Date(yearNumber, monthNumber, 0, 23, 59, 59);

    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        deletedAt: null,
        turf: { venueId: String(venueId) },
      },
      include: {
        turf: { select: { name: true, basePrice: true } },
      },
      orderBy: { date: "asc" },
    });

    const grouped: Record<string, typeof bookings> = {};
    for (const b of bookings) {
      const key = new Date(b.date).toISOString().split("T")[0];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    }

    res.json({ data: grouped, total: bookings.length });
  } catch (error) {
    next(error);
  }
};
