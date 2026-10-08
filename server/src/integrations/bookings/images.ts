import { chromium, type Browser } from "playwright";
import jwt from "jsonwebtoken";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ACCESS_COOKIE } from "../../utils/session.js";
import { publicOrigin } from "./auth.js";
import { calendarRange, type CalendarRequest } from "./calendar.js";

let rendering = false;
export async function withBrowser<T>(run: (browser: Browser) => Promise<T>): Promise<T> {
  if (rendering) throw new AppError("Another image is being rendered. Try again shortly.", 429);
  rendering = true;
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true, executablePath: config.bookingsMcp.chromiumExecutable, timeout: 20_000, args: ["--disable-dev-shm-usage"] });
    return await run(browser);
  } finally {
    try { await browser?.close(); } finally { rendering = false; }
  }
}

export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

export type CalendarEntry = { date: Date; startTime: string; endTime: string; status: string; customerName: string | null; bookingNumber?: string; duration?: number; user?: { firstName: string; lastName: string } | null; turf: { name: string }; };
export type CalendarSnapshot = { venue: { id: string; name: string; timezone: string }; startDate: string; endDate: string; audience: "public" | "staff"; bookings: CalendarEntry[]; generatedAt: string };
const customerLabel = (booking: CalendarEntry) => booking.customerName || [booking.user?.firstName, booking.user?.lastName].filter(Boolean).join(" ") || "Customer";
const clockLabel = (time: string) => { const [hour, minute] = time.split(":").map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`; };
const bookedMinutes = (booking: CalendarEntry) => booking.duration ?? (() => { const [startHour, startMinute] = booking.startTime.split(":").map(Number); const [endHour, endMinute] = booking.endTime.split(":").map(Number); const difference = (endHour - startHour) * 60 + endMinute - startMinute; return difference > 0 ? difference : difference + 1440; })();

export function calendarDetails(snapshot: CalendarSnapshot) {
  const bookings = snapshot.bookings.filter(booking => booking.status !== "CANCELLED");
  return {
    venue: snapshot.venue, startDate: snapshot.startDate, endDate: snapshot.endDate, audience: snapshot.audience, generatedAt: snapshot.generatedAt,
    summary: { totalBookings: bookings.length, hoursBooked: Math.round(bookings.reduce((sum, booking) => sum + bookedMinutes(booking), 0) / 60 * 100) / 100 },
    bookings: bookings.map(booking => ({ date: booking.date.toISOString().slice(0, 10), startTime: booking.startTime, endTime: booking.endTime, turf: booking.turf.name, ...(snapshot.audience === "staff" ? { bookingNumber: booking.bookingNumber, customerName: customerLabel(booking), status: booking.status } : { status: "BOOKED" }) })),
  };
}

export function calendarHtml(venue: { name: string; timezone: string }, startDate: string, endDate: string, bookings: CalendarEntry[], audience: "public" | "staff") {
  const days: string[] = [];
  for (let instant = Date.parse(`${startDate}T00:00:00Z`); instant <= Date.parse(`${endDate}T00:00:00Z`); instant += 86400_000) days.push(new Date(instant).toISOString().slice(0, 10));
  const active = bookings.filter(booking => booking.status !== "CANCELLED");
  const hours = Math.round(active.reduce((sum, booking) => sum + bookedMinutes(booking), 0) / 60 * 100) / 100;
  const generatedLabel = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: venue.timezone }).format(new Date());
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#153c2c;background:#eff5f1}main{padding:32px;width:${days.length === 1 ? 1000 : 1400}px}header{padding:28px;border-radius:18px;background:#0d4935;color:white;margin-bottom:20px}h1{margin:0 0 8px;font-size:30px}p{margin:0;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(${Math.min(days.length, 7)},1fr);gap:10px}.day{background:white;border:1px solid #d7e4da;border-radius:12px;padding:12px;min-height:200px}h2{font-size:16px;margin:0 0 12px}.slot{background:#e5f3eb;border-left:4px solid #27855c;padding:10px;margin-top:10px;border-radius:5px;font-size:${days.length < 3 ? 18 : 14}px;line-height:1.5;overflow-wrap:anywhere}.slot.pending{background:#fff4d8;border-color:#b8780c}.slot.rescheduled{background:#f0e8fb;border-color:#8056b2}.slot.completed{background:#edf0f2;border-color:#65767f}.empty{font-size:14px;color:#61756a}.label{font-size:13px;opacity:.8}.summary{margin-top:12px;font-weight:bold}.legend{display:flex;gap:18px;margin:0 0 18px;font-size:14px}.legend span:before{content:'●';margin-right:6px;color:#27855c}.legend .pending:before{color:#b8780c}.legend .rescheduled:before{color:#8056b2}.legend .completed:before{color:#65767f}.reference{font-size:11px;opacity:.7}footer{margin-top:20px;font-size:12px;color:#61756a}
    </style></head><body><main><header><p class="label">FUSION TURF · ${audience === "staff" ? "STAFF COPY" : "BOOKED SLOTS"}</p><h1>${escapeHtml(venue.name)}</h1><p>${escapeHtml(startDate)} — ${escapeHtml(endDate)} · ${escapeHtml(venue.timezone)}</p><p class="summary">${active.length} ${active.length === 1 ? "booking" : "bookings"} · ${hours} ${hours === 1 ? "hour" : "hours"} booked</p></header>${audience === "staff" ? '<div class="legend"><span>Confirmed</span><span class="pending">Pending</span><span class="rescheduled">Rescheduled</span><span class="completed">Completed</span></div>' : ""}<div class="grid">${days.map(day => {
    const entries = active.filter(booking => booking.date.toISOString().slice(0, 10) === day);
    return `<section class="day"><h2>${escapeHtml(new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`)))}</h2>${entries.length ? entries.map(booking => `<div class="slot${audience === "staff" && ["PENDING", "RESCHEDULED", "COMPLETED"].includes(booking.status) ? ` ${booking.status.toLowerCase()}` : ""}"><strong>${escapeHtml(clockLabel(booking.startTime))}–${escapeHtml(clockLabel(booking.endTime))}${booking.endTime <= booking.startTime ? " (+1 day)" : ""}</strong><br>${escapeHtml(booking.turf.name)}<br>${audience === "staff" ? `${escapeHtml(customerLabel(booking))} · ${escapeHtml(booking.status.toLowerCase())}${booking.bookingNumber ? `<div class="reference">${escapeHtml(booking.bookingNumber)}</div>` : ""}` : "Booked"}</div>`).join("") : '<p class="empty">No bookings recorded</p>'}</section>`;
  }).join("")}</div><footer>Generated ${escapeHtml(generatedLabel)} (${escapeHtml(venue.timezone)}) · Live snapshot; availability may change.${audience === "staff" ? " Contains customer names; share with staff only." : ""}</footer></main></body></html>`;
}

export async function loadCalendarSnapshot(args: CalendarRequest): Promise<CalendarSnapshot> {
  const venue = await prisma.venue.findFirst({ where: { id: args.venueId, deletedAt: null }, select: { id: true, name: true, timezone: true } });
  if (!venue) throw new AppError("Venue not found", 404);
  const { startDate, endDate } = calendarRange(args, venue.timezone);
  const bookings = await prisma.booking.findMany({ where: { deletedAt: null, status: { not: "CANCELLED" }, turf: { venueId: args.venueId }, date: { gte: new Date(`${startDate}T00:00:00Z`), lte: new Date(`${endDate}T23:59:59.999Z`) } }, select: { date: true, startTime: true, endTime: true, status: true, customerName: true, bookingNumber: true, duration: true, user: { select: { firstName: true, lastName: true } }, turf: { select: { name: true } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 201 });
  if (bookings.length > 200) throw new AppError("Choose a shorter date range for the calendar image (maximum 200 bookings).", 400);
  return { venue, startDate, endDate, audience: args.audience, bookings, generatedAt: new Date().toISOString() };
}

export async function renderCalendarSnapshot(snapshot: CalendarSnapshot) {
  const html = calendarHtml(snapshot.venue, snapshot.startDate, snapshot.endDate, snapshot.bookings, snapshot.audience);
  return withBrowser(async browser => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    await page.route("**/*", route => route.abort());
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });
    return page.locator("main").screenshot({ type: "png", timeout: 15_000 });
  });
}

export async function renderCalendar(args: { venueId: string; startDate: string; endDate: string; audience: "public" | "staff" }) {
  return renderCalendarSnapshot(await loadCalendarSnapshot({ ...args, view: "week" }));
}

export async function fetchCalendarWithImage(args: CalendarRequest) {
  const snapshot = await loadCalendarSnapshot(args);
  return { image: await renderCalendarSnapshot(snapshot), details: calendarDetails(snapshot) };
}

export async function screenshotWebsite(user: { userId: string; role: string }, args: { page: "calendar" | "bookings"; venueId?: string; date?: string; view: "month" | "week" | "day" }) {
  return withBrowser(async browser => {
    const frontend = new URL(config.frontendUrl);
    const allowedOrigins = new Set([frontend.origin, publicOrigin]);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
    const token = jwt.sign(user, config.jwt.secret, { expiresIn: "2m" });
    await context.addCookies([{ name: ACCESS_COOKIE, value: token, url: publicOrigin, httpOnly: true, secure: publicOrigin.startsWith("https:"), sameSite: "Lax" }]);
    if (frontend.origin !== publicOrigin) await context.addCookies([{ name: ACCESS_COOKIE, value: token, url: frontend.origin, httpOnly: true, secure: frontend.protocol === "https:", sameSite: "Lax" }]);
    await context.addInitScript(() => { localStorage.setItem("fusion_session_hint", "1"); });
    // The browser can only read this deployment, never visit a supplied URL or submit forms.
    await context.route("**/*", route => {
      const request = route.request();
      if (!["GET", "HEAD"].includes(request.method()) || !allowedOrigins.has(new URL(request.url()).origin)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const target = new URL("/admin", frontend);
    target.searchParams.set("tab", args.page);
    if (args.venueId) target.searchParams.set("mcpVenue", args.venueId);
    if (args.date) target.searchParams.set("mcpDate", args.date);
    target.searchParams.set("mcpView", args.view);
    const expected = args.page === "calendar" ? "/api/bookings/calendar" : "/api/admin/bookings";
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(expected) && response.request().method() === "GET", { timeout: 25_000 });
    await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 25_000 });
    const response = await loaded;
    if (!response.ok()) throw new AppError("The website could not load booking data for the screenshot", 502);
    if (args.page === "calendar") await page.locator('[data-booking-calendar="ready"]').waitFor({ timeout: 15_000 });
    else await page.getByRole("heading", { name: "Bookings", exact: true }).waitFor();
    await page.evaluate("document.fonts.ready");
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (args.page === "calendar") return page.locator('[data-booking-calendar="ready"]').screenshot({ type: "png", animations: "disabled", timeout: 15_000 });
    return page.screenshot({ type: "png", fullPage: false, animations: "disabled", timeout: 15_000 });
  });
}
