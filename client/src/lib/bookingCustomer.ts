import type { Booking } from "@/types";
import { getDisplayName } from "./utils";

export function bookingCustomerName(booking: Booking) {
  return booking.customerName?.trim() || getDisplayName(booking.user?.firstName, booking.user?.lastName) || "Guest";
}

export function bookingCustomerPhone(booking: Booking) {
  return booking.customerPhone?.trim() || booking.user?.phone || "";
}

export function bookingCustomerEmail(booking: Booking) {
  return booking.customerEmail?.trim() || booking.user?.email || "";
}
