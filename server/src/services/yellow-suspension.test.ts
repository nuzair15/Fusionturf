import { describe, expect, it } from "vitest";
import { consecutiveYellowMilestone } from "./yellow-suspension.js";

const yellow = [{ id: "yellow" }];

describe("consecutive yellow-card suspension", () => {
  it("bans after two successive team matches with yellow cards", () => {
    expect(consecutiveYellowMilestone([{ id: "a", cards: yellow }, { id: "b", cards: yellow }], "b", 2)).toBe(2);
  });

  it("does not ban when a match without a yellow breaks the streak", () => {
    const fixtures = [{ id: "a", cards: yellow }, { id: "b", cards: [] }, { id: "c", cards: yellow }];
    expect(consecutiveYellowMilestone(fixtures, "c", 2)).toBeNull();
  });

  it("uses the rule-set threshold and counts yellow cards for an idempotent milestone", () => {
    const fixtures = [{ id: "a", cards: yellow }, { id: "b", cards: yellow }, { id: "c", cards: yellow }];
    expect(consecutiveYellowMilestone(fixtures, "b", 3)).toBeNull();
    expect(consecutiveYellowMilestone(fixtures, "c", 3)).toBe(3);
  });
});
