export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function bookingDuration(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : end + 24 * 60 - start;
}

export function calculateBookingPrice(turf: { basePrice: number; peakPrice: number; weekendPrice: number; halfHourBilling: boolean }, date: Date, startTime: string, endTime: string) {
  const duration = bookingDuration(startTime, endTime);
  if (duration <= 0 || duration > 24 * 60 || duration % 30 !== 0) throw new Error("Booking duration must be in 30-minute increments and no longer than 24 hours");
  let hourlyPrice = turf.basePrice;
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) hourlyPrice = turf.weekendPrice || turf.basePrice;
  const startHour = Number(startTime.slice(0, 2));
  if (startHour >= 17 && startHour <= 21) hourlyPrice = turf.peakPrice || hourlyPrice;
  const units = turf.halfHourBilling ? duration / 30 : Math.ceil(duration / 60);
  const totalAmount = turf.halfHourBilling ? hourlyPrice * units / 2 : hourlyPrice * units;
  return { duration, hourlyPrice, totalAmount };
}

export function calculateDiscount(discountType: string, discountValue: number, grossAmount: number): number {
  if (discountType === "PERCENTAGE") return Math.min(grossAmount, Math.round(grossAmount * discountValue / 100));
  return Math.min(grossAmount, Math.max(0, discountValue));
}

export function formatThirtyMinuteSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  const opening = timeToMinutes(openTime);
  let closing = timeToMinutes(closeTime);
  if (closing <= opening) closing += 24 * 60;
  for (let cursor = opening; cursor < closing; cursor += 30) {
    const normalized = cursor % (24 * 60);
    slots.push(`${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`);
  }
  return slots;
}
