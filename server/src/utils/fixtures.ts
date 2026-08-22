import { MatchStatus } from "@prisma/client";
import { localNow, zonedDateTimeToUtc } from "./time.js";

export const ACTIVE_MATCH_STATUSES: MatchStatus[] = ["LIVE", "PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES"];

type FixtureForOrder = {
  id: string;
  status: MatchStatus;
  matchDate: Date;
  scheduledDate?: string | null;
  kickoffTime?: string | null;
  kickoffAt?: Date | null;
};

export function fixtureDateOnly(fixture: FixtureForOrder): string {
  return fixture.scheduledDate || fixture.matchDate.toISOString().slice(0, 10);
}

export function fixtureKickoffAt(fixture: FixtureForOrder, timezone = "Asia/Kolkata"): Date | null {
  if (fixture.kickoffAt) {
    const parsed = fixture.kickoffAt instanceof Date ? fixture.kickoffAt : new Date(fixture.kickoffAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!fixture.kickoffTime) return null;
  try {
    return zonedDateTimeToUtc(fixtureDateOnly(fixture), fixture.kickoffTime, timezone);
  } catch {
    return null;
  }
}

export function fixtureDisplayComparator(timezone = "Asia/Kolkata", now = new Date()) {
  const today = localNow(timezone, now).date;
  const bucket = (fixture: FixtureForOrder) => {
    if (ACTIVE_MATCH_STATUSES.includes(fixture.status)) return 0;
    const date = fixtureDateOnly(fixture);
    if (fixture.status === "SCHEDULED" && date === today) return 1;
    if (fixture.status === "SCHEDULED" && date > today) return 2;
    if (fixture.status === "COMPLETED") return 3;
    return 4;
  };
  return (left: FixtureForOrder, right: FixtureForOrder) => {
    const leftBucket = bucket(left);
    const rightBucket = bucket(right);
    if (leftBucket !== rightBucket) return leftBucket - rightBucket;
    const leftDate = fixtureDateOnly(left);
    const rightDate = fixtureDateOnly(right);
    if (leftBucket === 3) {
      if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    } else if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    const leftKickoff = fixtureKickoffAt(left, timezone)?.getTime();
    const rightKickoff = fixtureKickoffAt(right, timezone)?.getTime();
    if (leftKickoff !== undefined && rightKickoff === undefined) return -1;
    if (leftKickoff === undefined && rightKickoff !== undefined) return 1;
    if (leftKickoff !== undefined && rightKickoff !== undefined && leftKickoff !== rightKickoff) {
      return leftBucket === 3 ? rightKickoff - leftKickoff : leftKickoff - rightKickoff;
    }
    return left.id.localeCompare(right.id);
  };
}

export function fixtureTimeDto<T extends FixtureForOrder>(fixture: T, timezone = "Asia/Kolkata") {
  return {
    ...fixture,
    scheduledDate: fixtureDateOnly(fixture),
    kickoffAt: fixtureKickoffAt(fixture, timezone)?.toISOString() || null,
  };
}

export function fixtureScheduleFields(matchDate: Date | string, kickoffTime: string | null | undefined, timezone = "Asia/Kolkata") {
  const scheduledDate = typeof matchDate === "string"
    ? matchDate.slice(0, 10)
    : matchDate.toISOString().slice(0, 10);
  return {
    scheduledDate,
    kickoffAt: kickoffTime ? zonedDateTimeToUtc(scheduledDate, kickoffTime, timezone) : null,
  };
}
