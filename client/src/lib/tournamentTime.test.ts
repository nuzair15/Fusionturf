import { expect, it } from "vitest";
import { isTournamentOngoing, tournamentDateTimeInput, tournamentDateTimeIso } from "./tournamentTime";

it("round trips a Riyadh match time without using the browser timezone", () => {
  const iso = tournamentDateTimeIso("2026-10-10T18:00", "Asia/Riyadh");
  expect(iso).toBe("2026-10-10T15:00:00.000Z");
  expect(tournamentDateTimeInput(iso, "Asia/Riyadh")).toBe("2026-10-10T18:00");
});

it("shows a published tournament throughout its final local calendar day", () => {
  expect(isTournamentOngoing({ status: "PUBLISHED", startDate: "2026-10-10T00:00:00Z", endDate: "2026-10-11T00:00:00Z", timezone: "Asia/Riyadh" }, new Date("2026-10-11T19:00:00Z"))).toBe(true);
});
