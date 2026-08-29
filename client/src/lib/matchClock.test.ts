import { describe, expect, it } from "vitest";
import { eventMinuteFromClock, matchPeriodClock } from "./matchClock";

describe("30 + 30 match clock", () => {
  it("uses two 30-minute period clocks", () => {
    expect(matchPeriodClock(29 * 60 + 59, "LIVE")).toEqual({ label: "1ST HALF", seconds: 1799 });
    expect(matchPeriodClock(30 * 60, "HALF_TIME")).toEqual({ label: "HALF TIME", seconds: 1800 });
    expect(matchPeriodClock(30 * 60, "LIVE")).toEqual({ label: "2ND HALF", seconds: 0 });
    expect(matchPeriodClock(60 * 60, "LIVE")).toEqual({ label: "2ND HALF", seconds: 1800 });
  });

  it("keeps the event minute aligned with cumulative elapsed time", () => {
    expect(eventMinuteFromClock(0)).toBe(0);
    expect(eventMinuteFromClock(30 * 60)).toBe(30);
    expect(eventMinuteFromClock(59 * 60 + 59)).toBe(59);
    expect(eventMinuteFromClock(60 * 60)).toBe(60);
  });
});
