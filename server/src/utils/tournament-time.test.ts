import { expect, it } from "vitest";
import { tournamentLocalDate, tournamentLocalToUtc } from "./tournament-time.js";

it("keeps Riyadh kickoff time independent of the server timezone", () => {
  expect(tournamentLocalToUtc("2026-10-10", "18:00", "Asia/Riyadh").toISOString()).toBe("2026-10-10T15:00:00.000Z");
  expect(tournamentLocalDate(new Date("2026-10-10T22:00:00Z"), "Asia/Riyadh")).toBe("2026-10-11");
});

it("converts India tournament times using the configured timezone", () => {
  expect(tournamentLocalToUtc("2026-10-10", "08:00", "Asia/Kolkata").toISOString()).toBe("2026-10-10T02:30:00.000Z");
  expect(tournamentLocalDate(new Date("2026-10-10T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-11");
});
