import prisma from "../config/database.js";
import { sendAdminBookingNotification, sendBookingConfirmation } from "./email.js";

const MAX_ATTEMPTS = 8;
let workerTimer: NodeJS.Timeout | null = null;
let processing = false;

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      turf: { include: { venue: true } },
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      payments: true,
    },
  });
}

async function deliver(event: { eventType: string; aggregateId: string; payload: unknown }) {
  if (event.eventType === "MATCH_RESULT_PROJECTIONS") {
    const payload = (event.payload || {}) as { seasonId?: string; competitionId?: string; sourceVersion?: number };
    if (!payload.seasonId) throw new Error("Projection event is missing seasonId");
    const engine = await import("./league-system.js");
    await engine.recalculateStandings(payload.seasonId);
    await engine.recalculatePlayerStats(payload.seasonId);
    await engine.recalculateFriendlyPlayerStats(payload.seasonId);
    await engine.recalculateTeamStats(payload.seasonId);
    await engine.autoDetectAwards(payload.seasonId);
    if (payload.competitionId) {
      await prisma.projectionVersion.update({
        where: { competitionId_projection: { competitionId: payload.competitionId, projection: "MATCH_RESULT" } },
        data: { status: "BUILT", sourceVersion: payload.sourceVersion || 0, lastBuiltAt: new Date(), lastError: null },
      });
    }
    return;
  }
  if (event.eventType === "BOOKING_CREATED_CUSTOMER_EMAIL") {
    const booking = await loadBooking(event.aggregateId);
    if (!booking) return;
    const payload = (event.payload || {}) as { email?: string | null };
    const recipient = payload.email || booking.customerEmail || booking.user?.email;
    if (recipient) await sendBookingConfirmation(recipient, booking);
    return;
  }
  if (event.eventType === "BOOKING_CREATED_ADMIN_EMAIL") {
    const booking = await loadBooking(event.aggregateId);
    if (booking) await sendAdminBookingNotification(booking);
    return;
  }

  if (["BOOKING_STATUS_CHANGED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"].includes(event.eventType)) {
    const booking = await loadBooking(event.aggregateId);
    if (!booking) return;
    const recipient = booking.customerEmail || booking.user?.email;
    if (recipient) await sendBookingConfirmation(recipient, booking);
    return;
  }
  throw new Error(`No outbox handler for ${event.eventType}`);
}

export async function processOutboxBatch(limit = 20) {
  if (processing) return { claimed: 0 };
  processing = true;
  try {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.outboxEvent.updateMany({
      where: { status: "PROCESSING", updatedAt: { lt: staleBefore }, attempts: { lt: MAX_ATTEMPTS } },
      data: { status: "PENDING", lastError: "Recovered stale processing lease" },
    });
    const candidates = await prisma.outboxEvent.findMany({
      where: { status: "PENDING", availableAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    let claimed = 0;
    for (const event of candidates) {
      const lease = await prisma.outboxEvent.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: { status: "PROCESSING", attempts: { increment: 1 } },
      });
      if (lease.count !== 1) continue;
      claimed += 1;
      try {
        await deliver(event);
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "DELIVERED", processedAt: new Date(), lastError: null },
        });
      } catch (error) {
        const attempts = event.attempts + 1;
        const dead = attempts >= MAX_ATTEMPTS;
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: dead ? "DEAD_LETTER" : "PENDING",
            lastError: error instanceof Error ? error.message.slice(0, 2000) : "Unknown delivery error",
            availableAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
          },
        });
      }
    }
    return { claimed };
  } finally {
    processing = false;
  }
}

export function startOutboxWorker(intervalMs = 15_000) {
  if (workerTimer || process.env.NODE_ENV === "test") return;
  const tick = () => processOutboxBatch().catch((error) => console.error("Outbox worker failed", error));
  workerTimer = setInterval(tick, intervalMs);
  workerTimer.unref();
  tick();
}

export function stopOutboxWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}
