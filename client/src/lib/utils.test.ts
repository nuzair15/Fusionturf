import { describe, it, expect } from "vitest";
import { formatCurrency, formatTime, getInitials, getDisplayName } from "./utils";

describe("formatCurrency", () => {
  it("formats paise as INR, dividing by 100", () => {
    expect(formatCurrency(150000)).toBe("₹1,500");
  });
});

describe("formatTime", () => {
  it("converts 24-hour time to 12-hour with AM/PM", () => {
    expect(formatTime("09:30")).toBe("9:30 AM");
    expect(formatTime("13:00")).toBe("1:00 PM");
    expect(formatTime("00:15")).toBe("12:15 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
});

describe("getInitials", () => {
  it("uppercases the first letter of each name", () => {
    expect(getInitials("leo", "messi")).toBe("LM");
  });
});

describe("getDisplayName", () => {
  it("joins first and last name when both look like real names", () => {
    expect(getDisplayName("Leo", "Messi")).toBe("Leo Messi");
  });

  it("falls back to first name only when lastName is a phone number", () => {
    // Walk-in guest bookings can store a phone number in lastName — this
    // must never be shown to other users as if it were part of their name.
    expect(getDisplayName("Leo", "+91 98765 43210")).toBe("Leo");
  });

  it("falls back to first name only when lastName is a placeholder", () => {
    expect(getDisplayName("Leo", "Guest")).toBe("Leo");
    expect(getDisplayName("Leo", "N/A")).toBe("Leo");
  });

  it("returns 'Guest' when both names are empty", () => {
    expect(getDisplayName("", "")).toBe("Guest");
    expect(getDisplayName(null, null)).toBe("Guest");
  });
});
