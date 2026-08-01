import type { Booking } from "@/types";
import { formatBookingDate, formatTime, formatCurrency, getDisplayName } from "./utils";

export function buildBookingMessage(booking: Booking): string {
  const template = booking.turf?.venue?.bookingMessageTemplate?.trim();
  if (!template) return "";

  const customer = getDisplayName(booking.user?.firstName, booking.user?.lastName) || "there";
  const venue = booking.turf?.venue?.name || "";
  const date = formatBookingDate(booking.date);
  const start = formatTime(booking.startTime);
  const end = formatTime(booking.endTime);
  const amount = formatCurrency(booking.totalAmount);
  const bookingNumber = booking.bookingNumber;

  let msg = template.replace(/\r\n/g, "\n");

  // {placeholder} replacement syntax
  msg = msg
    .replace(/\{customer\}/g, customer)
    .replace(/\{venue\}/g, venue)
    .replace(/\{date\}/g, date)
    .replace(/\{startTime\}/g, start)
    .replace(/\{endTime\}/g, end)
    .replace(/\{amount\}/g, amount)
    .replace(/\{bookingNumber\}/g, bookingNumber);

  // Fill values after common labels (e.g. "🆔Booking ID: ", "📅 Date: ") so
  // admins can write a plain message without {placeholders}.
  // [ \t]* keeps whitespace within the line only, so newlines are never consumed.
  msg = msg.replace(/^([^\n]*?Booking[ \t]*ID[ \t]*[:：][ \t]*)[^\n]*$/im, `$1${bookingNumber}`);
  msg = msg.replace(/^([^\n]*?Date[ \t]*[:：][ \t]*)[^\n]*$/im, `$1${date}`);
  msg = msg.replace(/^([^\n]*?Time[ \t]*[:：][ \t]*)[^\n]*$/im, `$1${start} to ${end}`);
  msg = msg.replace(/^([^\n]*?Amount[ \t]*[:：][ \t]*)[^\n]*$/im, `$1${amount}`);

  return msg;
}
