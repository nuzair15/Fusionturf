import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import { config } from "../config/index.js";
import { getStripeClient } from "../lib/stripe.js";
import { AppError } from "../middleware/errorHandler.js";
import { paginate, paginatedResponse, generateBookingNumber } from "../utils/helpers.js";
import bcrypt from "bcryptjs";
import { sendBookingConfirmation } from "../services/email.js";
import { createNotification } from "../services/notification.js";

const createBookingSchema = z.object({
  body: z.object({
    turfId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD"),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid start time"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid end time"),
    customerName: z.string().min(1),
    customerPhone: z.string().min(1),
    customerEmail: z.string().email().optional().or(z.literal("")),
    notes: z.string().optional(),
  }).superRefine((body, ctx) => {
    if (body.startTime >= body.endTime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "endTime must be after startTime" });
    if (new Date(`${body.date}T00:00:00`).getTime() < new Date(new Date().toDateString()).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "booking date cannot be in the past" });
    }
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

export const getBookedSlotsForTurf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turfId } = req.params;
    const { date } = req.query;
    if (!date) throw new AppError("date query param required", 400);
    const matchDate = new Date(date as string);
    const bookings = await prisma.booking.findMany({
      where: {
        turfId,
        date: matchDate,
        status: { not: "CANCELLED" },
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBookingSchema.parse(req).body;

    const turf = await prisma.turf.findUnique({ where: { id: data.turfId }, include: { venue: true } });
    if (!turf) throw new AppError("Turf not found", 404);

    const matchDate = new Date(data.date);

    // Check if date is blocked
    if (turf.venue) {
      const blocked = await prisma.blockedDate.findFirst({
        where: { venueId: turf.venue.id, date: matchDate },
      });
      if (blocked) throw new AppError(`This date is blocked: ${blocked.reason || "No reason given"}`, 400);
    }

    let hourlyPrice = turf.basePrice;
    const dayOfWeek = matchDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      hourlyPrice = turf.weekendPrice || turf.basePrice;
    }

    const hour = parseInt(data.startTime.split(":")[0], 10);
    if ((hour >= 17 && hour <= 21)) {
      hourlyPrice = turf.peakPrice || hourlyPrice;
    }

    const duration = (parseInt(data.endTime.slice(0, 2), 10) * 60 + parseInt(data.endTime.slice(3), 10)) -
      (parseInt(data.startTime.slice(0, 2), 10) * 60 + parseInt(data.startTime.slice(3), 10));
    const totalAmount = turf.halfHourBilling
      ? hourlyPrice * (Math.ceil(duration / 30) / 2)
      : hourlyPrice * Math.ceil(duration / 60);

    // Create or find guest user for walk-in bookings. IMPORTANT: this must
    // never use a predictable/shared password. An earlier version hashed the
    // literal string "guest" here, which meant anyone who knew (or guessed)
    // a real person's email could book as a guest using that email and then
    // log in as them with password "guest" — full account takeover. A random
    // password means the account is created but simply isn't loginable
    // until the owner goes through a real password-reset flow.
    const guestEmail = data.customerEmail || `guest-${Date.now()}@fusionturf.com`;
    let guest = await prisma.user.findUnique({ where: { email: guestEmail } });
    if (!guest) {
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
    if (guest.email) sendBookingConfirmation(guest.email, booking).catch(() => {});
  } catch (error) {
    next(error);
  }
};

// ─── Payments (Stripe) ───
//
// Bookings were previously created with a Payment row that stayed PENDING
// forever — nothing in the codebase ever called Stripe, so there was no way
// to actually collect money online. These two endpoints implement the
// minimum real flow: create a PaymentIntent for a pending payment, and
// confirm it via a signature-verified webhook (never trust a client-side
// "it succeeded" call for this). The client still needs to be wired up to
// Stripe Elements/Checkout using the returned clientSecret — that's a
// frontend task tracked separately.

export const createPaymentIntent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) throw new AppError("Online payments are not configured", 503);

    const payment = await prisma.payment.findFirst({
      where: { bookingId: req.params.id },
      include: { booking: true },
    });
    if (!payment) throw new AppError("Payment not found for this booking", 404);
    if (payment.status === "PAID") throw new AppError("This booking has already been paid", 400);

    const intent = await stripe.paymentIntents.create({
      amount: payment.amount,
      currency: (payment.currency || "inr").toLowerCase(),
      metadata: { bookingId: payment.bookingId, paymentId: payment.id },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentId: intent.id },
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (error) {
    next(error);
  }
};

export const stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = getStripeClient();
    if (!stripe || !config.stripe.webhookSecret) throw new AppError("Online payments are not configured", 503);

    const signature = req.headers["stripe-signature"];
    if (!signature) throw new AppError("Missing Stripe signature", 400);

    let event;
    try {
      // req.body must be the raw, unparsed request body for signature
      // verification to work — see the express.raw() wiring in index.ts.
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
    } catch (err: any) {
      throw new AppError(`Webhook signature verification failed: ${err.message}`, 400);
    }

    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as { id: string; metadata?: Record<string, string> };
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        const succeeded = event.type === "payment_intent.succeeded";
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: paymentId },
            data: { status: succeeded ? "PAID" : "FAILED", transactionId: intent.id },
          }),
          ...(succeeded && intent.metadata?.bookingId
            ? [prisma.booking.update({ where: { id: intent.metadata.bookingId }, data: { status: "CONFIRMED" } })]
            : []),
        ]);
      }
    }

    res.json({ received: true });
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

export const adminUpdateBookingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"].includes(status)) {
      throw new AppError("Invalid status", 400);
    }
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { status: true, userId: true, bookingNumber: true } });
    if (!booking) throw new AppError("Booking not found", 404);
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status },
    });
    if (status !== booking.status) {
      createNotification(
        booking.userId,
        "Booking status updated",
        `Your booking ${booking.bookingNumber} is now ${status.toLowerCase()}.`,
        "booking"
      ).catch(() => {});
    }
    res.json(updated);
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
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!booking) throw new AppError("Booking not found", 404);
    const updated = await prisma.payment.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "PAID", ...(method ? { method } : {}) },
    });
    res.json({ count: updated.count });
  } catch (error) {
    next(error);
  }
};

export const adminRefundBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!booking) throw new AppError("Booking not found", 404);
    const updated = await prisma.payment.updateMany({
      where: { bookingId: booking.id, status: { in: ["PENDING", "PAID"] } },
      data: { status: "REFUNDED" },
    });
    res.json({ count: updated.count });
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
      select: { id: true, totalAmount: true, discountAmount: true },
    });
    if (!booking) throw new AppError("Booking not found", 404);

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

export const adminUpdateBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, startTime, endTime } = req.body;
    const updateData: any = {};
    if (date) updateData.date = new Date(date);
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      updateData.duration = (eh + em / 60) - (sh + sm / 60);
    }
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(booking);
  } catch (error) {
    next(error);
  }
};

export const adminGetAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const where: any = {};
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
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { booking: { status: { not: "CANCELLED" } } },
      }),
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

export const getCalendarBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueId, month, year } = req.query;
    if (!venueId || !month || !year) return res.status(400).json({ error: "venueId, month, year required" });

    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
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
