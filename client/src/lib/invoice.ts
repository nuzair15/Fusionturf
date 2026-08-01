import type { Booking } from "@/types";
import { formatTime } from "./utils";

const inr = (paise: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((paise || 0) / 100);

const fmtDate = (d: string | Date): string =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const fmtLongDate = (d: string | Date): string =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const resolveUrl = (url: string | undefined): string => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
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

export function openBookingInvoice(booking: Booking, settings: Record<string, string>) {
  const logo = resolveUrl(settings.site_logo_url || "/logo.png");
  const upiQr = resolveUrl(settings.invoice_upi_qr);
  const terms = settings.invoice_terms?.trim() || DEFAULT_INVOICE_TERMS;

  const invoiceNumber = booking.bookingNumber.startsWith("FUSIONRK-BK-")
    ? `FUSIONRK-INV-${booking.bookingNumber.slice("FUSIONRK-BK-".length)}`
    : booking.bookingNumber;

  const businessName = settings.site_name || "Fusion Turf";
  const businessEmail = settings.contact_email || "";
  const businessPhone = settings.contact_phone || "";

  const customerName = `${booking.user?.firstName || ""} ${booking.user?.lastName || ""}`.trim() || "Guest";
  const customerPhone = booking.user?.phone || "";
  const customerEmail = booking.user?.email || "";

  const hours = Math.ceil((booking.duration || 0) / 60) || 1;
  const services = booking.bookingServices || [];
  const servicesTotal = services.reduce((sum, s) => sum + (s.price || 0) * (s.quantity || 1), 0);
  const baseAmount = Math.max(0, (booking.totalAmount || 0) + (booking.discountAmount || 0) - servicesTotal);
  const ratePerHour = Math.round(baseAmount / hours);

  const paid = (booking.payments || []).filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const balance = (booking.totalAmount || 0) - paid;

  const paymentLine = booking.payments && booking.payments.length > 0
    ? booking.payments.map((p) => `${p.method || "Payment"} (${p.status}) ${inr(p.amount)}${p.transactionId ? ` — #${p.transactionId}` : ""}`).join("<br/>")
    : "Pending";

  const itemRows = [
    `<tr>
      <td>Turf Rental — ${booking.turf?.name || "Turf"} (${hours} hr)</td>
      <td class="num">${inr(ratePerHour)}</td>
      <td class="num">${hours}</td>
      <td class="num">${inr(baseAmount)}</td>
    </tr>`,
    ...services.map((s) => `
      <tr>
        <td>${s.additionalService?.name || "Additional Service"} × ${s.quantity}</td>
        <td class="num">${inr(s.price)}</td>
        <td class="num">${s.quantity}</td>
        <td class="num">${inr(s.price * s.quantity)}</td>
      </tr>`),
  ].join("");

  const discountRow = (booking.discountAmount || 0) > 0
    ? `<tr>
        <td>Discount${booking.couponCode ? ` (${booking.couponCode})` : ""}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num negative">− ${inr(booking.discountAmount)}</td>
      </tr>`
    : "";

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice #${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2332; background: #f2f4f7; padding: 24px; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px 44px; border: 1px solid #e3e7ee; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0b5e46; padding-bottom: 20px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { max-height: 64px; max-width: 180px; object-fit: contain; }
  .brand .name { font-size: 22px; font-weight: 700; color: #0b5e46; letter-spacing: 0.5px; }
  .brand .tagline { font-size: 12px; color: #66707e; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 28px; letter-spacing: 4px; color: #1a2332; }
  .invoice-title p { font-size: 12px; color: #66707e; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin: 24px 0; }
  .meta .col h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a93a0; margin-bottom: 8px; }
  .meta p { font-size: 13px; line-height: 1.55; }
  .meta .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0 6px; }
  th { background: #0b5e46; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; text-align: left; padding: 10px 12px; }
  th.num, td.num { text-align: right; }
  td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #eef1f5; }
  .total-row td { font-weight: 700; font-size: 14px; border-bottom: 2px solid #1a2332; padding-top: 14px; }
  .grand-total td { font-size: 18px; color: #0b5e46; border-top: 2px solid #0b5e46; border-bottom: none; }
  .negative { color: #c0392b; }
  .summary { display: flex; justify-content: space-between; gap: 24px; margin-top: 20px; }
  .paybox { flex: 1; border: 1px solid #e3e7ee; border-radius: 8px; padding: 16px; font-size: 13px; }
  .paybox h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a93a0; margin-bottom: 8px; }
  .qrcode { text-align: center; }
  .qrcode img { width: 150px; height: 150px; object-fit: contain; border: 1px solid #e3e7ee; border-radius: 8px; padding: 8px; background: #fff; }
  .qrcode p { font-size: 11px; color: #66707e; margin-top: 6px; }
  .terms { margin-top: 26px; padding-top: 18px; border-top: 1px solid #e3e7ee; }
  .terms h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a93a0; margin-bottom: 8px; }
  .terms p { font-size: 11.5px; line-height: 1.7; color: #4a5568; white-space: pre-line; }
  .footer { text-align: center; margin-top: 26px; padding-top: 14px; border-top: 1px dashed #e3e7ee; font-size: 11px; color: #8a93a0; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        ${logo ? `<img src="${logo}" alt="${businessName}" />` : `<div><div class="name">${businessName}</div></div>`}
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <p>Invoice No: ${invoiceNumber}</p>
        <p>Invoice Date: ${fmtDate(booking.createdAt || new Date())}</p>
        <p>Booking ID: ${booking.bookingNumber}</p>
        <p>Booking Date: ${fmtLongDate(booking.date)} (${formatTime(booking.startTime)} - ${formatTime(booking.endTime)})</p>
        <p>Venue: ${booking.turf?.venue?.name || ""}${booking.turf?.name ? ` — ${booking.turf.name}` : ""}</p>
      </div>
    </div>

    <div class="meta">
      <div class="col">
        <h3>Billed To</h3>
        <p><strong>${customerName}</strong><br/>${customerPhone ? `Phone: ${customerPhone}<br/>` : ""}${customerEmail ? `Email: ${customerEmail}` : ""}</p>
      </div>
      <div class="col right">
        <h3>${businessName}</h3>
        <p>${businessPhone ? `Phone: ${businessPhone}<br/>` : ""}${businessEmail ? `Email: ${businessEmail}` : ""}</p>
      </div>
    </div>

    <div class="meta">
      <div class="col">
        <h3>Booking Details</h3>
        <p>
          <strong>${booking.turf?.venue?.name || "Venue"}</strong> — ${booking.turf?.name || "Turf"}<br/>
          Date: ${fmtLongDate(booking.date)}<br/>
          Time: ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}<br/>
          Duration: ${booking.duration} min<br/>
          Status: <strong>${booking.status}</strong>
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Description</th><th class="num">Rate</th><th class="num">Qty</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>
        ${itemRows}
        ${discountRow}
        <tr class="total-row"><td colspan="3">Total</td><td class="num">${inr(booking.totalAmount)}</td></tr>
        <tr class="grand-total"><td colspan="3">Amount Paid</td><td class="num">${inr(paid)}</td></tr>
        ${balance > 0 ? `<tr class="grand-total"><td colspan="3">Balance Due</td><td class="num">${inr(balance)}</td></tr>` : ""}
      </tbody>
    </table>

    <div class="summary">
      <div class="paybox">
        <h3>Payment Details</h3>
        <p>${paymentLine}</p>
      </div>
      ${upiQr ? `
      <div class="paybox qrcode">
        <h3>Scan to Pay (UPI)</h3>
        <img src="${upiQr}" alt="UPI QR" />
        <p>Scan this QR with any UPI app to pay</p>
      </div>` : ""}
    </div>

    <div class="terms">
      <h3>Terms &amp; Conditions</h3>
      <p>${terms.replace(/</g, "&lt;")}</p>
    </div>

    <div class="footer">
      Thank you for choosing ${businessName}! This is a computer-generated invoice and does not require a signature.
    </div>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
