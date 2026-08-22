import nodemailer from "nodemailer";
import { config } from "../config/index.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
const safeSubject = (value: unknown) => String(value ?? "").replace(/[\r\n]/g, "");

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({ from: config.smtp.from, to, subject: safeSubject(subject), html });
};

export const sendBookingConfirmation = async (email: string, booking: any) => {
  const status = String(booking.status || "PENDING").toUpperCase();
  const statusLabel = status === "CONFIRMED" ? "Confirmed" : status === "PENDING" ? "Received" : status.replaceAll("_", " ");
  const html = `
    <h1>Booking ${escapeHtml(statusLabel)}</h1>
    <p>Your booking #${escapeHtml(booking.bookingNumber)} is currently <strong>${escapeHtml(status)}</strong>.</p>
    ${status === "PENDING" ? "<p>We have received your request. It is not confirmed until its status changes to CONFIRMED.</p>" : ""}
    <p><strong>Venue:</strong> ${escapeHtml(booking.turf?.venue?.name)}</p>
    <p><strong>Date:</strong> ${escapeHtml(new Date(booking.date).toLocaleDateString())}</p>
    <p><strong>Time:</strong> ${escapeHtml(booking.startTime)} - ${escapeHtml(booking.endTime)}</p>
    <p><strong>Amount:</strong> ₹${(booking.totalAmount / 100).toFixed(2)}</p>
  `;
  await sendEmail(email, `Booking ${statusLabel} - ${safeSubject(booking.bookingNumber)}`, html);
};

export const sendAdminBookingNotification = async (booking: any) => {
  const recipient = config.smtp.adminBookingEmail;
  if (!recipient) {
    console.warn("ADMIN_BOOKING_EMAIL is not configured; skipping booking admin notification");
    return;
  }

  const customer = booking.user || {};
  const paymentRecorded = booking.payments?.some((payment: any) => payment.status === "COMPLETED" || payment.status === "PAID");
  const rows: Array<[string, unknown]> = [
    ["Booking number", booking.bookingNumber],
    ["Customer", booking.customerName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim()],
    ["Phone", booking.customerPhone || customer.phone],
    ["Email", booking.customerEmail || customer.email],
    ["Venue", booking.turf?.venue?.name],
    ["Turf", booking.turf?.name],
    ["Date", new Date(booking.date).toLocaleDateString()],
    ["Time", `${booking.startTime} – ${booking.endTime}`],
    ["Duration", `${booking.duration} minutes`],
    ["Total", `₹${(booking.totalAmount / 100).toFixed(2)}`],
    ["Discount", `₹${(booking.discountAmount / 100).toFixed(2)}`],
    ["Coupon", booking.couponCode || "None"],
    ["Booking status", booking.status],
    ["Payment", paymentRecorded ? "Recorded" : "Pending manual recording"],
    ["Notes", booking.notes || "None"],
  ];
  const html = `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:auto"><h2>New FusionTurf Booking</h2><table style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;width:38%">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`).join("")}</table></div>`;
  await sendEmail(recipient, `New FusionTurf Booking — ${safeSubject(booking.bookingNumber)}`, html);
};
