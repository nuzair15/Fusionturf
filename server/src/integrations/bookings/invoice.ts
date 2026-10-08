import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { escapeHtml, withBrowser } from "./images.js";
import { storeInvoicePdf, type InvoiceFileOwner } from "./files.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const invoiceOutputSchema = {
  bookingId: z.string(), bookingNumber: z.string(), invoiceNumber: z.string(), customerName: z.string(),
  venue: z.string(), turf: z.string(), timezone: z.string(), date: z.string(), startTime: z.string(), endTime: z.string(), status: z.string(), currency: z.literal("INR"),
  rental: z.object({ grossRental: z.number().int(), quantity: z.number().int(), unitMinutes: z.number().int(), rate: z.number().int() }),
  servicesTotalMinor: z.number().int(), totalAmountMinor: z.number().int(), discountAmountMinor: z.number().int(), amountPaidMinor: z.number().int(), refundedAmountMinor: z.number().int(), balanceDueMinor: z.number().int(),
  file: z.object({ url: z.string().url(), fileName: z.string(), mimeType: z.literal("application/pdf"), size: z.number().int(), expiresAt: z.string().datetime() }),
};

export type InvoicePayment = { amount: number; status: string; method?: string | null; transactionId?: string | null; refundAmount?: number };
export type InvoiceBooking = {
  id: string; bookingNumber: string; createdAt: Date; date: Date; startTime: string; endTime: string; duration: number; status: string;
  totalAmount: number; discountAmount: number; couponCode?: string | null; customerName?: string | null;
  user?: { firstName: string; lastName: string } | null;
  turf: { name: string; halfHourBilling: boolean; venue: { name: string; timezone: string } };
  payments: InvoicePayment[];
  ledgerEntries?: { type: string; amount: number }[];
  bookingServices: { quantity: number; price: number; additionalService: { name: string } }[];
};

export const DEFAULT_INVOICE_TERMS = [
  "1. Booking confirmation is subject to slot availability at the time of booking.",
  "2. Full payment must be received to confirm and secure the booking.",
  "3. Cancellation and rescheduling must be communicated at least 24 hours in advance; refunds are subject to management approval.",
  "4. Please arrive at least 10 minutes before your scheduled time. No-shows and late arrivals are non-refundable.",
  "5. Any damage to venue property or equipment will be billed to the customer.",
  "6. The venue is not responsible for loss or damage of personal belongings.",
  "7. All players must follow the venue rules and safety guidelines during their slot.",
  "8. If the slot is extended on the spot beyond the booked duration, different (extended) pricing will apply and will be billed accordingly.",
  "9. For any queries regarding this invoice, contact us using the details above.",
].join("\n");

export function invoiceDetails(booking: InvoiceBooking) {
  const servicesTotal = booking.bookingServices.reduce((sum, service) => sum + service.price * service.quantity, 0);
  const grossRental = Math.max(0, booking.totalAmount + booking.discountAmount - servicesTotal);
  const unitMinutes = booking.turf.halfHourBilling ? 30 : 60;
  const quantity = Math.max(1, Math.ceil(Math.max(0, booking.duration) / unitMinutes));
  const ledger = (booking.ledgerEntries || []).filter(entry => ["PAYMENT_CAPTURED", "PAYMENT_REFUNDED"].includes(entry.type));
  const captured = ledger.length ? ledger.filter(entry => entry.type === "PAYMENT_CAPTURED").reduce((sum, entry) => sum + entry.amount, 0) : booking.payments.filter(payment => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)).reduce((sum, payment) => sum + payment.amount, 0);
  const refunded = ledger.length ? ledger.filter(entry => entry.type === "PAYMENT_REFUNDED").reduce((sum, entry) => sum + entry.amount, 0) : booking.payments.reduce((sum, payment) => sum + (payment.refundAmount || 0), 0);
  const amountPaid = Math.max(0, captured - refunded);
  return {
    bookingId: booking.id, bookingNumber: booking.bookingNumber,
    invoiceNumber: booking.bookingNumber.startsWith("FUSIONRK-BK-") ? `FUSIONRK-INV-${booking.bookingNumber.slice("FUSIONRK-BK-".length)}` : booking.bookingNumber,
    customerName: booking.customerName?.trim() || [booking.user?.firstName, booking.user?.lastName].filter(Boolean).join(" ") || "Guest",
    venue: booking.turf.venue.name, turf: booking.turf.name, timezone: booking.turf.venue.timezone,
    date: booking.date.toISOString().slice(0, 10), startTime: booking.startTime, endTime: booking.endTime, status: booking.status, currency: "INR",
    rental: { grossRental, quantity, unitMinutes, rate: Math.round(grossRental / quantity) }, servicesTotalMinor: servicesTotal,
    totalAmountMinor: booking.totalAmount, discountAmountMinor: booking.discountAmount, amountPaidMinor: amountPaid, refundedAmountMinor: refunded,
    balanceDueMinor: booking.status === "CANCELLED" ? 0 : Math.max(0, booking.totalAmount - amountPaid),
  };
}

export function invoiceAssetUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value, config.frontendUrl);
    if (url.username || url.password || !/\.(?:png|jpe?g|webp)(?:$|\?)/i.test(url.href)) return "";
    const frontend = new URL(config.frontendUrl);
    const localAsset = url.origin === frontend.origin;
    const cloudAsset = !!config.cloudinary.cloudName && url.origin === "https://res.cloudinary.com" && url.pathname.startsWith(`/${config.cloudinary.cloudName}/image/upload/`);
    return localAsset || cloudAsset ? url.href : "";
  } catch { return ""; }
}

export function invoiceHtml(booking: InvoiceBooking, settings: Record<string, string>) {
  const invoice = invoiceDetails(booking);
  const businessName = settings.site_name || "Fusion Turf";
  const logo = invoiceAssetUrl(settings.site_logo_url || "/logo.png");
  const qr = invoiceAssetUrl(settings.invoice_upi_qr);
  const terms = settings.invoice_terms?.trim() || DEFAULT_INVOICE_TERMS;
  const inr = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount / 100);
  const clock = (time: string) => { const [hour, minute] = time.split(":").map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`; };
  const bookingDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(booking.date);
  const invoiceDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: invoice.timezone }).format(booking.createdAt);
  const payments = booking.payments.length ? booking.payments.map(payment => `${escapeHtml(payment.method || "Payment")} (${escapeHtml(payment.status)}) ${inr(payment.amount)}${payment.transactionId ? ` — #${escapeHtml(payment.transactionId)}` : ""}`).join("<br>") : "Pending";
  const serviceRows = booking.bookingServices.map(service => `<tr><td>${escapeHtml(service.additionalService.name)}</td><td class="num">${inr(service.price)}</td><td class="num">${service.quantity}</td><td class="num">${inr(service.price * service.quantity)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1a2332;margin:0;font-size:12px}.page{width:100%}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0b5e46;padding-bottom:16px}.brand{width:35%}.brand img{max-height:64px;max-width:180px;object-fit:contain}.brand h2{color:#0b5e46;font-size:22px}.title{text-align:right;max-width:62%}.title h1{font-size:17px}.title p{margin:5px 0;color:#66707e;font-size:10px}.meta{display:flex;justify-content:space-between;gap:18px;margin:18px 0}.right{text-align:right}h3{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#66707e;margin:0 0 7px}p{line-height:1.5;margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0b5e46;color:white;font-size:10px;text-align:left;padding:9px}td{padding:9px;border-bottom:1px solid #e3e7ee;vertical-align:top}.num{text-align:right;white-space:nowrap}.total td{font-weight:bold;border-top:2px solid #0b5e46}.amount td{color:#0b5e46;font-weight:bold}.negative{color:#b1392b}.summary{display:flex;gap:18px;margin-top:20px}.paybox{border:1px solid #e3e7ee;border-radius:8px;padding:12px;flex:1}.qr{text-align:center}.qr img{width:135px;height:135px;object-fit:contain}.terms{margin-top:22px;border-top:1px solid #e3e7ee;padding-top:12px}.terms p{white-space:pre-line;font-size:10px;color:#4a5568;line-height:1.6}.footer{text-align:center;font-size:9px;color:#66707e;margin-top:18px;padding-top:10px;border-top:1px dashed #e3e7ee}tr,.header,.meta,.paybox{break-inside:avoid}thead{display:table-header-group}
    </style></head><body><div class="page"><div class="header"><div class="brand">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(businessName)}">` : `<h2>${escapeHtml(businessName)}</h2>`}</div><div class="title"><h1>BOOKING DETAILS &amp; INVOICE</h1><p>Invoice No: ${escapeHtml(invoice.invoiceNumber)}</p><p>Invoice Date: ${escapeHtml(invoiceDate)}</p><p>Booking ID: ${escapeHtml(booking.bookingNumber)}</p><p>Booking Date: ${escapeHtml(bookingDate)} (${clock(booking.startTime)}–${clock(booking.endTime)})</p><p>${escapeHtml(invoice.venue)} — ${escapeHtml(invoice.turf)}</p></div></div>
    <div class="meta"><div><h3>Billed To</h3><p><strong>${escapeHtml(invoice.customerName)}</strong></p></div><div class="right"><h3>${escapeHtml(businessName)}</h3>${settings.contact_phone ? `<p>Phone: ${escapeHtml(settings.contact_phone)}</p>` : ""}${settings.contact_email ? `<p>Email: ${escapeHtml(settings.contact_email)}</p>` : ""}</div></div>
    <div class="meta"><div><h3>Booking Details</h3><p><strong>${escapeHtml(invoice.venue)}</strong> — ${escapeHtml(invoice.turf)}<br>Date: ${escapeHtml(bookingDate)}<br>Time: ${clock(booking.startTime)} to ${clock(booking.endTime)}${booking.endTime <= booking.startTime ? " (+1 day)" : ""} (${escapeHtml(invoice.timezone)})<br>Duration: ${booking.duration} min<br>Billing: ${invoice.rental.quantity} × ${invoice.rental.unitMinutes} min<br>Status: <strong>${escapeHtml(booking.status)}</strong></p></div></div>
    <table><thead><tr><th>Description</th><th class="num">Rate</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody><tr><td>Turf Rental — ${escapeHtml(invoice.turf)} (${invoice.rental.quantity} × ${invoice.rental.unitMinutes} min)</td><td class="num">${inr(invoice.rental.rate)}</td><td class="num">${invoice.rental.quantity}</td><td class="num">${inr(invoice.rental.grossRental)}</td></tr>${serviceRows}${booking.discountAmount > 0 ? `<tr><td>Discount${booking.couponCode ? ` (${escapeHtml(booking.couponCode)})` : ""}</td><td></td><td></td><td class="num negative">− ${inr(booking.discountAmount)}</td></tr>` : ""}<tr class="total"><td colspan="3">Total</td><td class="num">${inr(booking.totalAmount)}</td></tr><tr class="amount"><td colspan="3">Amount Paid${invoice.refundedAmountMinor ? " (after refunds)" : ""}</td><td class="num">${inr(invoice.amountPaidMinor)}</td></tr>${invoice.refundedAmountMinor > 0 ? `<tr><td colspan="3">Amount Refunded</td><td class="num">${inr(invoice.refundedAmountMinor)}</td></tr>` : ""}${invoice.balanceDueMinor > 0 ? `<tr class="amount"><td colspan="3">Balance Due</td><td class="num">${inr(invoice.balanceDueMinor)}</td></tr>` : ""}</tbody></table>
    <div class="summary"><div class="paybox"><h3>Payment Details</h3><p>${payments}</p>${booking.status === "CANCELLED" ? "<p>This booking is cancelled; no new balance is due.</p>" : ""}</div>${qr && booking.status !== "CANCELLED" ? `<div class="paybox qr"><h3>Scan to Pay (UPI)</h3><img src="${escapeHtml(qr)}" alt="UPI QR"><p>Scan this QR with any UPI app to pay</p></div>` : ""}</div><div class="terms"><h3>Terms &amp; Conditions</h3><p>${escapeHtml(terms)}</p></div><div class="footer">Thank you for choosing ${escapeHtml(businessName)}! This is a computer-generated invoice and does not require a signature.</div></div></body></html>`;
}

export async function renderInvoicePdf(booking: InvoiceBooking, settings: Record<string, string>) {
  const html = invoiceHtml(booking, settings);
  const assets = new Set([invoiceAssetUrl(settings.site_logo_url || "/logo.png"), invoiceAssetUrl(settings.invoice_upi_qr)].filter(Boolean));
  return withBrowser(async browser => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.route("**/*", route => assets.has(route.request().url()) && route.request().resourceType() === "image" ? route.continue() : route.abort());
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    return page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  });
}

export async function getBookingInvoice(bookingIdOrNumber: string, owner: InvoiceFileOwner) {
  const { booking, rows } = await prisma.$transaction(async tx => {
    const booking = await tx.booking.findFirst({ where: { deletedAt: null, OR: [{ id: bookingIdOrNumber }, { bookingNumber: bookingIdOrNumber }] }, include: { turf: { include: { venue: true } }, user: { select: { firstName: true, lastName: true } }, payments: true, ledgerEntries: { select: { type: true, amount: true } }, bookingServices: { include: { additionalService: { select: { name: true } } } } } });
    if (!booking) throw new AppError("Booking not found. Find the exact booking ID or booking number first.", 404);
    const rows = await tx.setting.findMany({ where: { key: { in: ["site_name", "site_logo_url", "contact_phone", "contact_email", "invoice_upi_qr", "invoice_terms"] } }, select: { key: true, value: true } });
    return { booking, rows };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const pdf = await renderInvoicePdf(booking, settings);
  return { ...invoiceDetails(booking), file: await storeInvoicePdf(pdf, booking.bookingNumber, owner) };
}

export function invoiceMcpResult(invoice: Awaited<ReturnType<typeof getBookingInvoice>>) {
  return {
    structuredContent: invoice,
    content: [
      { type: "resource_link" as const, uri: invoice.file.url, name: invoice.file.fileName, title: `Invoice ${invoice.invoiceNumber}`, description: "Booking details and invoice PDF. Download link expires in 15 minutes.", mimeType: "application/pdf", size: invoice.file.size },
      { type: "text" as const, text: `The invoice PDF is ready. Include this download link in your reply: [Download ${invoice.file.fileName}](${invoice.file.url}). If your environment supports file downloads, you may download this exact PDF and attach it in chat. ${JSON.stringify(invoice)}` },
    ],
  };
}
