import { describe, it, expect } from "vitest";
import { calculateBookingPrice, calculateDiscount, formatThirtyMinuteSlots } from "./booking.js";

const turf = { basePrice: 10000, peakPrice: 14000, weekendPrice: 12000, halfHourBilling: true };

describe("calculateBookingPrice", () => {
  it("prices a 30-minute slot at half the hourly rate", () => {
    expect(calculateBookingPrice(turf, new Date("2026-08-10"), "10:00", "10:30")).toEqual({
      duration: 30,
      hourlyPrice: 10000,
      totalAmount: 5000,
    });
  });

  it("prices a 90-minute slot proportionally", () => {
    expect(calculateBookingPrice(turf, new Date("2026-08-10"), "10:00", "11:30").totalAmount).toBe(15000);
  });

  it("rejects a duration that isn't a whole 30-minute increment", () => {
    expect(() => calculateBookingPrice(turf, new Date("2026-08-10"), "10:00", "10:20")).toThrow();
  });
});

describe("calculateDiscount", () => {
  it("computes a percentage discount", () => {
    expect(calculateDiscount("PERCENTAGE", 10, 15000)).toBe(1500);
  });

  it("caps a fixed discount at the booking total", () => {
    expect(calculateDiscount("FIXED", 20000, 15000)).toBe(15000);
  });
});

describe("formatThirtyMinuteSlots", () => {
  it("splits a range into 30-minute slot start times", () => {
    expect(formatThirtyMinuteSlots("06:00", "07:30")).toEqual(["06:00", "06:30", "07:00"]);
  });
});
