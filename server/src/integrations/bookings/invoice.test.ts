import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
const mockedConnection = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("../../config/database.js", () => ({ default: { mcpConnection: mockedConnection } }));
import { config } from "../../config/index.js";
import { invoiceAssetUrl, invoiceDetails, invoiceHtml, type InvoiceBooking } from "./invoice.js";
import { readInvoicePdf, signInvoiceDownload, verifyInvoiceDownload } from "./files.js";

const booking: InvoiceBooking = {
  id: "booking", bookingNumber: "FUSIONRK-BK-2030-0001", createdAt: new Date("2030-01-01T20:00:00Z"), date: new Date("2030-01-10"),
  startTime: "08:00", endTime: "09:30", duration: 90, status: "CONFIRMED", totalAmount: 150000, discountAmount: 10000, couponCode: "SAVE", customerName: "Ahmed",
  turf: { name: "Turf 1", halfHourBilling: true, venue: { name: "Fusion", timezone: "Asia/Kolkata" } },
  payments: [{ amount: 60000, status: "PAID", method: "UPI" }, { amount: 90000, status: "PENDING" }],
  bookingServices: [{ quantity: 2, price: 5000, additionalService: { name: "Equipment" } }],
};
const id = "abcdef0123456789abcdef0123456789";
const fileName = "invoice-FUSIONRK-BK-2030-0001.pdf";
const owner = { userId: "staff", connectionId: "connection" };

describe("booking invoice PDF", () => {
  it("uses stored services, discounts and half-hour billing without counting pending payments", () => {
    const details = invoiceDetails(booking);
    expect(details.invoiceNumber).toBe("FUSIONRK-INV-2030-0001");
    expect(details.rental).toEqual({ grossRental: 150000, quantity: 3, unitMinutes: 30, rate: 50000 });
    expect(details.servicesTotalMinor).toBe(10000);
    expect(details.amountPaidMinor).toBe(60000);
    expect(details.balanceDueMinor).toBe(90000);
  });
  it("uses the immutable payment ledger and deducts refunds", () => {
    const details = invoiceDetails({ ...booking, ledgerEntries: [{ type: "PAYMENT_CAPTURED", amount: 60000 }, { type: "PAYMENT_REFUNDED", amount: 10000 }] });
    expect(details.amountPaidMinor).toBe(50000);
    expect(details.refundedAmountMinor).toBe(10000);
    expect(details.balanceDueMinor).toBe(100000);
  });
  it("does not ask for a new payment on cancelled/refunded bookings", () => {
    const cancelled = { ...booking, status: "CANCELLED", payments: [{ amount: 60000, status: "REFUNDED", refundAmount: 60000 }] };
    expect(invoiceDetails(cancelled).balanceDueMinor).toBe(0);
    expect(invoiceDetails(cancelled).amountPaidMinor).toBe(0);
    expect(invoiceHtml(cancelled, { invoice_upi_qr: "/qr.png" })).not.toContain('alt="UPI QR"');
  });
  it("includes the current invoice terms, local dates and booking details", () => {
    const html = invoiceHtml(booking, { site_name: "Fusion Test", contact_phone: "12345", invoice_terms: "Custom booking terms" });
    for (const value of ["BOOKING DETAILS &amp; INVOICE", "FUSIONRK-INV-2030-0001", "Ahmed", "Custom booking terms", "3 × 30 min", "8:00 AM to 9:30 AM", "Asia/Kolkata", "02 Jan 2030"]) expect(html).toContain(value);
  });
  it("escapes customer strings and configured text before rendering", () => {
    const html = invoiceHtml({ ...booking, customerName: '<script>alert("bad")</script>' }, { site_name: "Fusion <img>", invoice_terms: "<script>bad()</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Fusion &lt;img&gt;");
  });
  it("blocks arbitrary invoice asset hosts and script URLs", () => {
    for (const url of ["http://169.254.169.254/latest/meta-data/file.png", "https://evil.example/logo.png", "javascript:alert(1)", "https://user:pass@evil.example/a.png", "data:image/svg+xml,<svg/>"]) expect(invoiceAssetUrl(url)).toBe("");
    expect(invoiceAssetUrl("/logo.png")).toBe(new URL("/logo.png", config.frontendUrl).href);
  });
  it("binds download tokens to the exact PDF and prevents website-session reuse", () => {
    const token = signInvoiceDownload(id, fileName, owner);
    expect(verifyInvoiceDownload(id, fileName, token)).toMatchObject(owner);
    expect(() => verifyInvoiceDownload(id, "different.pdf", token)).toThrow();
    expect(() => verifyInvoiceDownload("../file", fileName, token)).toThrow();
    expect(() => verifyInvoiceDownload(id, fileName, token + "bad")).toThrow();
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });
  it("rejects expired links", () => {
    vi.useFakeTimers();
    try {
      const token = signInvoiceDownload(id, fileName, owner);
      vi.setSystemTime(Date.now() + 16 * 60_000);
      expect(() => verifyInvoiceDownload(id, fileName, token)).toThrow("expired");
    } finally { vi.useRealTimers(); }
  });
  it("denies cross-account resource reads and revoked/deactivated staff access", async () => {
    const token = signInvoiceDownload(id, fileName, owner);
    await expect(readInvoicePdf(id, fileName, token, "another-staff")).rejects.toThrow("different connected account");
    for (const connection of [null, { scopes: ["bookings:read"], user: { isActive: false, role: "BOOKING_ADMIN" } }, { scopes: ["bookings:read"], user: { isActive: true, role: "CUSTOMER" } }, { scopes: ["bookings:write"], user: { isActive: true, role: "BOOKING_ADMIN" } }]) {
      mockedConnection.findFirst.mockResolvedValue(connection);
      await expect(readInvoicePdf(id, fileName, token)).rejects.toThrow("revoked");
    }
  });
});
