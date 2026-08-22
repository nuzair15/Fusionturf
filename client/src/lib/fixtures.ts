import type { Fixture, MatchStatus } from "@/types";

export const ACTIVE_MATCH_STATUSES: MatchStatus[] = ["LIVE", "PAUSED", "HALF_TIME", "EXTRA_TIME", "PENALTIES"];

export function fixtureDateKey(fixture: Pick<Fixture, "scheduledDate" | "matchDate">): string {
  return fixture.scheduledDate || fixture.matchDate.slice(0, 10);
}

export function businessDateKey(timezone = "Asia/Kolkata", instant = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function isActiveMatch(status: MatchStatus): boolean {
  return ACTIVE_MATCH_STATUSES.includes(status);
}

function kickoffKey(fixture: Fixture): number {
  if (fixture.kickoffAt) return Date.parse(fixture.kickoffAt);
  if (fixture.kickoffTime) {
    const [hours, minutes] = fixture.kickoffTime.split(":").map(Number);
    return hours * 60 + minutes;
  }
  return Number.POSITIVE_INFINITY;
}

export function fixtureDisplayComparator(timezone = "Asia/Kolkata") {
  const today = businessDateKey(timezone);
  const bucket = (fixture: Fixture) => {
    const date = fixtureDateKey(fixture);
    if (isActiveMatch(fixture.status)) return 0;
    if (fixture.status === "SCHEDULED" && date === today) return 1;
    if (fixture.status === "SCHEDULED" && date > today) return 2;
    if (fixture.status === "COMPLETED") return 3;
    return 4;
  };
  return (a: Fixture, b: Fixture) => {
    const aBucket = bucket(a);
    const bBucket = bucket(b);
    if (aBucket !== bBucket) return aBucket - bBucket;
    const dateOrder = fixtureDateKey(a).localeCompare(fixtureDateKey(b));
    if (dateOrder !== 0) return aBucket === 3 || aBucket === 4 ? -dateOrder : dateOrder;
    const timeOrder = kickoffKey(a) - kickoffKey(b);
    if (Number.isFinite(timeOrder) && timeOrder !== 0) return aBucket === 3 ? -timeOrder : timeOrder;
    return a.id.localeCompare(b.id);
  };
}

export function sortedFixtures(fixtures: Fixture[], timezone = "Asia/Kolkata"): Fixture[] {
  return [...fixtures].sort(fixtureDisplayComparator(timezone));
}

export function fixtureScoreLabel(fixture: Fixture): string {
  return fixture.status === "COMPLETED" || isActiveMatch(fixture.status)
    ? `${fixture.homeScore ?? 0}-${fixture.awayScore ?? 0}`
    : "VS";
}

