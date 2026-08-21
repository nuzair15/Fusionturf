import nodemailer from "nodemailer";
import { config } from "../config/index.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({ from: config.smtp.from, to, subject, html });
};

export const sendBookingConfirmation = async (email: string, booking: any) => {
  const html = `
    <h1>Booking Confirmed!</h1>
    <p>Your booking #${booking.bookingNumber} has been confirmed.</p>
    <p><strong>Venue:</strong> ${booking.turf.venue.name}</p>
    <p><strong>Date:</strong> ${new Date(booking.date).toLocaleDateString()}</p>
    <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
    <p><strong>Amount:</strong> ₹${(booking.totalAmount / 100).toFixed(2)}</p>
    ${booking.qrCodeData ? `<img src="${booking.qrCodeData}" alt="QR Code" />` : ""}
  `;
  await sendEmail(email, `Booking Confirmed - ${booking.bookingNumber}`, html);
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));

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
    ["Customer", `${customer.firstName || ""} ${customer.lastName || ""}`.trim()],
    ["Phone", customer.phone],
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
  await sendEmail(recipient, `New FusionTurf Booking — ${booking.bookingNumber}`, html);
};
