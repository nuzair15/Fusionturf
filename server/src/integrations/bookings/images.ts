import { chromium, type Browser } from "playwright";
import jwt from "jsonwebtoken";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ACCESS_COOKIE } from "../../utils/session.js";
import { publicOrigin } from "./auth.js";
import { calendarRange, type CalendarRequest } from "./calendar.js";
import { calendarHtml } from "./calendar-image.js";
export { calendarHtml } from "./calendar-image.js";

let rendering = false;
export async function withBrowser<T>(run: (browser: Browser) => Promise<T>): Promise<T> {
  if (rendering) throw new AppError("Another file is being generated. Try again shortly.", 429);
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
const bookedMinutes = (booking: CalendarEntry) => booking.duration ?? (() => { const [startHour, startMinute] = booking.startTime.split(":").map(Number); const [endHour, endMinute] = booking.endTime.split(":").map(Number); const difference = (endHour - startHour) * 60 + endMinute - startMinute; return difference > 0 ? difference : difference + 1440; })();

export function calendarDetails(snapshot: CalendarSnapshot) {
  const bookings = snapshot.bookings.filter(booking => booking.status !== "CANCELLED");
  return {
    venue: snapshot.venue, startDate: snapshot.startDate, endDate: snapshot.endDate, audience: snapshot.audience, generatedAt: snapshot.generatedAt,
    summary: { totalBookings: bookings.length, hoursBooked: Math.round(bookings.reduce((sum, booking) => sum + bookedMinutes(booking), 0) / 60 * 100) / 100 },
    bookings: bookings.map(booking => ({ date: booking.date.toISOString().slice(0, 10), startTime: booking.startTime, endTime: booking.endTime, turf: booking.turf.name, ...(snapshot.audience === "staff" ? { bookingNumber: booking.bookingNumber, customerName: customerLabel(booking), status: booking.status } : { status: "BOOKED" }) })),
  };
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
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
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
