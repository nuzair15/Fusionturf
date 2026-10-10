import { describe, expect, it } from "vitest";
import { canTransitionMatch } from "./match-state.js";

describe("match state transitions", () => {
  it("allows normal and extra-time progressions", () => {
    expect(canTransitionMatch("SCHEDULED", "LIVE")).toBe(true);
    expect(canTransitionMatch("HALF_TIME", "LIVE")).toBe(true);
    expect(canTransitionMatch("EXTRA_TIME", "PENALTIES")).toBe(true);
    expect(canTransitionMatch("PENALTIES", "COMPLETED")).toBe(true);
    expect(canTransitionMatch("COMPLETED", "LIVE")).toBe(true);
  });

  it("rejects reopening cancelled matches and skipping from postponed to live", () => {
    expect(canTransitionMatch("CANCELLED", "SCHEDULED")).toBe(false);
    expect(canTransitionMatch("POSTPONED", "LIVE")).toBe(false);
  });
});

