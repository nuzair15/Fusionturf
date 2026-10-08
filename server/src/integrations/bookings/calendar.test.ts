import { describe, expect, it } from "vitest";
import { calendarRange } from "./calendar.js";
import { calendarDetails, calendarHtml, type CalendarSnapshot } from "./images.js";
import { calendarMcpResult } from "./tools.js";

const snapshot: CalendarSnapshot = {
  venue: { id: "venue", name: "Fusion", timezone: "Asia/Kolkata" }, startDate: "2030-01-10", endDate: "2030-01-10", audience: "staff", generatedAt: "2030-01-10T00:00:00Z",
  bookings: [
    { date: new Date("2030-01-10"), startTime: "08:00", endTime: "09:00", status: "CONFIRMED", customerName: null, user: { firstName: "Legacy", lastName: "Customer" }, bookingNumber: "BK-1", duration: 60, turf: { name: "Turf 1" } },
    { date: new Date("2030-01-10"), startTime: "09:00", endTime: "09:30", status: "PENDING", customerName: "Ahmed", bookingNumber: "BK-2", duration: 30, turf: { name: "Turf 1" } },
    { date: new Date("2030-01-10"), startTime: "22:00", endTime: "01:00", status: "RESCHEDULED", customerName: "Sara", bookingNumber: "BK-3", turf: { name: "Turf 2" } },
    { date: new Date("2030-01-10"), startTime: "11:00", endTime: "12:00", status: "CANCELLED", customerName: "Cancelled customer", duration: 60, turf: { name: "Turf 1" } },
  ],
};

describe("calendar requests return details and an image", () => {
  it("defaults to seven days using the venue date across UTC midnight", () => {
    expect(calendarRange({ view: "week" }, "Asia/Kolkata", new Date("2026-10-07T20:00:00Z"))).toEqual({ startDate: "2026-10-08", endDate: "2026-10-14" });
  });
  it("resolves a day without extending the requested date", () => {
    expect(calendarRange({ startDate: "2030-01-10", view: "day" }, "Asia/Kolkata")).toEqual({ startDate: "2030-01-10", endDate: "2030-01-10" });
  });
  it("resolves the whole current month, including leap-year February", () => {
    expect(calendarRange({ view: "month" }, "Asia/Kolkata", new Date("2028-02-15T10:00:00Z"))).toEqual({ startDate: "2028-02-01", endDate: "2028-02-29" });
  });
  it("preserves an explicitly supplied date range", () => {
    expect(calendarRange({ startDate: "2030-01-10", endDate: "2030-01-12", view: "week" }, "Asia/Kolkata")).toEqual({ startDate: "2030-01-10", endDate: "2030-01-12" });
  });
  it("rejects impossible, reversed and excessively long ranges", () => {
    for (const request of [{ startDate: "2030-02-30", view: "day" as const }, { startDate: "2030-01-10", endDate: "2030-01-09", view: "week" as const }, { startDate: "2030-01-01", endDate: "2030-02-01", view: "week" as const }]) expect(() => calendarRange(request, "Asia/Kolkata")).toThrow();
  });
  it("summarizes active bookings with customer names, including legacy bookings", () => {
    const details = calendarDetails(snapshot);
    expect(details.summary).toEqual({ totalBookings: 3, hoursBooked: 4.5 });
    expect(details.bookings[0]).toMatchObject({ customerName: "Legacy Customer", bookingNumber: "BK-1", status: "CONFIRMED" });
    expect(JSON.stringify(details)).not.toContain("Cancelled customer");
  });
  it("removes customer names and booking references from public details and images", () => {
    const publicCopy = { ...snapshot, audience: "public" as const };
    const details = JSON.stringify(calendarDetails(publicCopy));
    const html = calendarHtml(publicCopy.venue, publicCopy.startDate, publicCopy.endDate, publicCopy.bookings, "public");
    for (const privateValue of ["Legacy Customer", "Ahmed", "Sara", "BK-1", "BK-2", "Cancelled customer"]) { expect(details).not.toContain(privateValue); expect(html).not.toContain(privateValue); }
  });
  it("renders readable local times, overnight labels, status colours and totals", () => {
    const html = calendarHtml(snapshot.venue, snapshot.startDate, snapshot.endDate, snapshot.bookings, "staff");
    expect(html).toContain("8:00 AM–9:00 AM");
    expect(html).toContain("10:00 PM–1:00 AM (+1 day)");
    expect(html).toContain('class="slot pending"');
    expect(html).toContain("3 bookings · 4.5 hours booked");
    expect(html).toContain("repeat(1,1fr)");
  });
  it("aligns the month to Sunday-first weekdays and visibly marks booked dates", () => {
    const html = calendarHtml(snapshot.venue, "2026-10-01", "2026-10-31", [{ ...snapshot.bookings[0], date: new Date("2026-10-08") }], "staff");
    expect(html).toContain("October 2026");
    expect(html).toContain('<div class="weekdays"><div>Sun</div><div>Mon</div>');
    // October 1 is Thursday: four leading cells and five complete calendar rows.
    expect(html.match(/class="day outside"/g)).toHaveLength(4);
    expect(html.match(/data-date="2026-10-/g)).toHaveLength(31);
    expect(html).toMatch(/class="day booked[^"]*" data-date="2026-10-08"/);
    expect(html).toContain('<span class="count">1 booking</span>');
    expect(html).toContain('class="slot confirmed"');
    expect(html).toContain("Legacy Customer");
    expect(html).toContain("--background:hsl(222 47% 5%)");
    expect(html).toContain("--primary:hsl(142 76% 55%)");
  });
  it("escapes booking labels in the themed image", () => {
    const html = calendarHtml({ ...snapshot.venue, name: "<img onerror=alert(1)>" }, snapshot.startDate, snapshot.endDate, [{ ...snapshot.bookings[0], customerName: "<script>alert(1)</script>" }], "staff");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;script&gt;");
  });
  it("returns the PNG and the exact live details together in a single MCP result", () => {
    const details = calendarDetails(snapshot);
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const file = { url: "https://fusionturf.in/api/integrations/bookings/files/file/calendar.png?token=test", fileName: "calendar.png", mimeType: "image/png", size: png.length, expiresAt: "2030-01-10T00:15:00Z" };
    const result = calendarMcpResult({ image: png, details }, file);
    expect(result.content[0]).toEqual({ type: "image", data: png.toString("base64"), mimeType: "image/png" });
    expect(result.structuredContent).toEqual({ ...details, image: file });
    expect(JSON.parse(result.content[1].text!)).toEqual(result.structuredContent);
    expect(result.content[2]).toMatchObject({ type: "resource_link", uri: file.url, mimeType: "image/png" });
    expect(result.content[3].text).toContain(`[Open / save calendar PNG](${file.url})`);
  });
});
