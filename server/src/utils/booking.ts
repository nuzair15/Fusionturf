export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function bookingDuration(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function calculateBookingPrice(turf: { basePrice: number; peakPrice: number; weekendPrice: number; halfHourBilling: boolean }, date: Date, startTime: string, endTime: string) {
  const duration = bookingDuration(startTime, endTime);
  if (duration <= 0 || duration % 30 !== 0) throw new Error("Booking duration must be in 30-minute increments");
  let hourlyPrice = turf.basePrice;
  if (date.getDay() === 0 || date.getDay() === 6) hourlyPrice = turf.weekendPrice || turf.basePrice;
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
  for (let cursor = timeToMinutes(openTime); cursor < timeToMinutes(closeTime); cursor += 30) {
    slots.push(`${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`);
  }
  return slots;
}
