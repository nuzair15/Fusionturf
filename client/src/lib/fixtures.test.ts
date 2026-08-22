import { describe, expect, it } from "vitest";
import { businessDateKey, fixtureDisplayComparator } from "./fixtures";

const fixture = (id: string, status: string, scheduledDate: string, kickoffAt: string | null = null) => ({ id, status, scheduledDate, kickoffAt, matchDate: `${scheduledDate}T00:00:00.000Z` }) as any;

describe("fixtureDisplayComparator", () => {
  it("orders live phases before today's and future scheduled fixtures", () => {
    const today = businessDateKey("Asia/Kolkata");
    const future = "2099-12-31";
    const rows = [fixture("future", "SCHEDULED", future), fixture("today", "SCHEDULED", today), fixture("live", "HALF_TIME", "2000-01-01")];
    rows.sort(fixtureDisplayComparator("Asia/Kolkata"));
    expect(rows.map((row) => row.id)).toEqual(["live", "today", "future"]);
  });

  it("puts known same-day kickoff times before TBD and uses id as a stable key", () => {
    const rows = [fixture("z-tbd", "SCHEDULED", "2099-01-01"), fixture("b", "SCHEDULED", "2099-01-01", "2099-01-01T12:00:00.000Z"), fixture("a", "SCHEDULED", "2099-01-01", "2099-01-01T12:00:00.000Z")];
    rows.sort(fixtureDisplayComparator("Asia/Kolkata"));
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "z-tbd"]);
  });

  it("orders completed history newest first after scheduled matches", () => {
    const rows = [fixture("old", "COMPLETED", "2020-01-01"), fixture("scheduled", "SCHEDULED", "2099-01-01"), fixture("new", "COMPLETED", "2021-01-01")];
    rows.sort(fixtureDisplayComparator("Asia/Kolkata"));
    expect(rows.map((row) => row.id)).toEqual(["scheduled", "new", "old"]);
  });
});
