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
  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
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
