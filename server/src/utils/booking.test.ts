import assert from "node:assert/strict";
import { calculateBookingPrice, calculateDiscount, formatThirtyMinuteSlots } from "./booking.js";

const turf = { basePrice: 10000, peakPrice: 14000, weekendPrice: 12000, halfHourBilling: true };
assert.deepEqual(calculateBookingPrice(turf, new Date("2026-08-10"), "10:00", "10:30"), { duration: 30, hourlyPrice: 10000, totalAmount: 5000 });
assert.equal(calculateBookingPrice(turf, new Date("2026-08-10"), "10:00", "11:30").totalAmount, 15000);
assert.equal(calculateDiscount("PERCENTAGE", 10, 15000), 1500);
assert.equal(calculateDiscount("FIXED", 20000, 15000), 15000);
assert.deepEqual(formatThirtyMinuteSlots("06:00", "07:30"), ["06:00", "06:30", "07:00"]);
assert.throws(() => calculateBookingPrice(turf, new Date("2026-08-10"), "10:00", "10:20"));
console.log("booking utility tests passed");
