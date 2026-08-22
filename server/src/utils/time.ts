const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidTimeOnly(value: string): boolean {
  return TIME_ONLY.test(value);
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error(`Invalid IANA timezone: ${timezone}`);
  }
}

/** Convert a venue-local date/time to the UTC instant stored by Prisma. */
export function zonedDateTimeToUtc(dateOnly: string, timeOnly: string, timezone: string): Date {
  if (!isValidDateOnly(dateOnly) || !isValidTimeOnly(timeOnly)) throw new Error("Invalid local date/time");
  assertTimezone(timezone);
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute] = timeOnly.split(":").map(Number);
  const desiredUtcShape = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = new Date(desiredUtcShape);

  // Re-evaluate once so DST boundaries converge for zones that use them.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(candidate, timezone);
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    candidate = new Date(candidate.getTime() + desiredUtcShape - represented);
  }
  return candidate;
}

export function localDateTimeRange(
  dateOnly: string,
  startTime: string,
  endTime: string,
  timezone: string,
): { startAt: Date; endAt: Date; durationMinutes: number } {
  const startAt = zonedDateTimeToUtc(dateOnly, startTime, timezone);
  let endAt = zonedDateTimeToUtc(dateOnly, endTime, timezone);
  if (endAt <= startAt) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  return { startAt, endAt, durationMinutes };
}

export function localNow(timezone: string, instant = new Date()): { date: string; time: string } {
  assertTimezone(timezone);
  const parts = zonedParts(instant, timezone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function weekdayForDateOnly(dateOnly: string, timezone: string): number {
  // Noon avoids crossing a date boundary in every real-world UTC offset.
  const instant = zonedDateTimeToUtc(dateOnly, "12:00", timezone);
  const short = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(instant);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export function legacyDateOnly(dateOnly: string): Date {
  if (!isValidDateOnly(dateOnly)) throw new Error("Invalid date-only value");
  return new Date(`${dateOnly}T00:00:00.000Z`);
}
