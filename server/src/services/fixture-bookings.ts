import { MatchStatus } from "@prisma/client";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { legacyDateOnly, localDateTimeRange, localNow } from "../utils/time.js";

const RESERVATION_PREFIX = "fixture-reservation:";
const MATCH_DURATION_MINUTES = 60;

function reservationKey(fixtureId: string) {
  return `${RESERVATION_PREFIX}${fixtureId}`;
}

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function turfForFixture(venueId?: string | null) {
  if (venueId) {
    const turf = await prisma.turf.findFirst({ where: { venueId, isActive: true, deletedAt: null }, orderBy: { createdAt: "asc" }, include: { venue: { select: { timezone: true } } } });
    if (turf) return turf;
  }
  const turfs = await prisma.turf.findMany({ where: { isActive: true, deletedAt: null }, take: 2, orderBy: { createdAt: "asc" }, include: { venue: { select: { timezone: true } } } });
  if (turfs.length === 1) return turfs[0];
  if (!turfs.length) throw new AppError("Cannot reserve this fixture because there is no active turf", 409);
  throw new AppError("Cannot reserve this fixture automatically because multiple turfs are active. Assign a venue first.", 409);
}

/** Creates or updates the no-cost reservation which blocks a league match slot. */
export async function syncFixtureBooking(fixtureId: string) {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId }, select: { id: true, venueId: true, scheduledDate: true, kickoffTime: true, status: true, deletedAt: true } });
  if (!fixture) throw new AppError("Fixture not found", 404);
  const key = reservationKey(fixture.id);
  const existing = await prisma.booking.findUnique({ where: { idempotencyKey: key } });

  // A fixture created historically does not need a retroactive customer-slot
  // reservation. Scheduled fixtures receive one at creation/backfill time.
  if (fixture.status === MatchStatus.COMPLETED && !existing) return null;

  if (fixture.deletedAt || fixture.status === MatchStatus.CANCELLED || fixture.status === MatchStatus.POSTPONED) {
    if (existing) await prisma.booking.update({ where: { id: existing.id }, data: { status: "CANCELLED", blocksAvailability: false, cancellationReason: "Fixture cancelled or postponed" } });
    return existing;
  }
  if (!fixture.scheduledDate || !fixture.kickoffTime) throw new AppError("Fixture needs a date and kickoff time before its turf can be reserved", 409);

  const turf = await turfForFixture(fixture.venueId);
  const startTime = fixture.kickoffTime;
  const endTime = addMinutes(startTime, MATCH_DURATION_MINUTES);
  const timezone = turf.venue?.timezone || "Asia/Kolkata";
  const range = localDateTimeRange(fixture.scheduledDate, startTime, endTime, timezone);
  const conflict = await prisma.booking.findFirst({
    where: { turfId: turf.id, deletedAt: null, blocksAvailability: true, startAt: { lt: range.endAt }, endAt: { gt: range.startAt }, ...(existing ? { id: { not: existing.id } } : {}) },
    select: { bookingNumber: true },
  });
  if (conflict) throw new AppError(`Cannot reserve the match slot: it overlaps booking ${conflict.bookingNumber}`, 409);

  const data = {
    turfId: turf.id, date: legacyDateOnly(fixture.scheduledDate), startTime, endTime, startAt: range.startAt, endAt: range.endAt,
    duration: MATCH_DURATION_MINUTES, numPlayers: 12, totalAmount: 0, discountAmount: 0,
    customerName: "Fusion League", customerPhone: "", customerEmail: null,
    status: "CONFIRMED" as const, blocksAvailability: true,
    notes: `Automatic league match reservation for fixture ${fixture.id}`,
  };
  return prisma.booking.upsert({ where: { idempotencyKey: key }, create: { ...data, bookingNumber: `LEAGUE-${fixture.id.slice(0, 8).toUpperCase()}`, idempotencyKey: key }, update: data });
}

export async function syncUpcomingFixtureBookings() {
  const today = localNow("Asia/Kolkata").date;
  const fixtures = await prisma.fixture.findMany({ where: { deletedAt: null, scheduledDate: { gte: today }, status: { notIn: [MatchStatus.CANCELLED, MatchStatus.POSTPONED] } }, select: { id: true } });
  const failures: Array<{ fixtureId: string; message: string }> = [];
  let synced = 0;
  for (const fixture of fixtures) {
    try { await syncFixtureBooking(fixture.id); synced += 1; }
    catch (error: any) { failures.push({ fixtureId: fixture.id, message: error?.message || "Unknown error" }); }
  }
  return { synced, failures };
}
