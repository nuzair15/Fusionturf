import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  booking: { findFirst: vi.fn() }, setting: { findMany: vi.fn() }, transaction: vi.fn(),
  page: { route: vi.fn(), setContent: vi.fn(), pdf: vi.fn() }, store: vi.fn(),
}));
vi.mock("../../config/database.js", () => ({ default: { $transaction: mocks.transaction } }));
vi.mock("./files.js", () => ({ storeInvoicePdf: mocks.store }));
vi.mock("./images.js", async importOriginal => ({
  ...await importOriginal<typeof import("./images.js")>(),
  withBrowser: async (run: (browser: unknown) => Promise<unknown>) => run({ newPage: async () => mocks.page }),
}));
import { getBookingInvoice } from "./invoice.js";

const booking = {
  id: "booking", bookingNumber: "BK-1", createdAt: new Date("2030-01-01"), date: new Date("2030-01-10"),
  startTime: "08:00", endTime: "09:00", duration: 60, status: "CONFIRMED", totalAmount: 100000, discountAmount: 0,
  customerName: "Customer", customerPhone: "+91 98765 43210",
  user: { firstName: "Legacy", lastName: "Customer", phone: "+91 91234 56789" },
  turf: { name: "Turf", halfHourBilling: false, venue: { name: "Fusion", timezone: "Asia/Kolkata" } },
  payments: [], ledgerEntries: [], bookingServices: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(run => run({ booking: mocks.booking, setting: mocks.setting }));
  mocks.setting.findMany.mockResolvedValue([{ key: "contact_phone", value: "Venue phone" }]);
  mocks.page.pdf.mockResolvedValue(Buffer.from("%PDF-1.7 test"));
  mocks.store.mockResolvedValue({ url: "https://example.com/invoice.pdf", downloadUrl: "https://example.com/invoice.pdf?download=1" });
});

describe("MCP invoice customer phone retrieval", () => {
  it("passes the stored booking phone through the PDF and tool details", async () => {
    mocks.booking.findFirst.mockResolvedValue(booking);
    const invoice = await getBookingInvoice("BK-1", { userId: "staff", connectionId: "connection" });
    expect(invoice.customerPhone).toBe(booking.customerPhone);
    const html = mocks.page.setContent.mock.calls[0][0];
    expect(html).toContain(`<p>Phone: ${booking.customerPhone}</p>`);
    expect(html).toContain("Phone: Venue phone");
    expect(html).not.toContain(booking.user.phone);
  });
  it("fetches the linked account phone for a legacy booking and renders it", async () => {
    // Respect Prisma's selected fields so omitting phone in the query reproduces
    // the original missing-phone bug rather than passing with a generous mock.
    mocks.booking.findFirst.mockImplementation(async args => ({
      ...booking, customerPhone: null,
      user: { firstName: booking.user.firstName, lastName: booking.user.lastName, ...(args.include.user.select.phone ? { phone: booking.user.phone } : {}) },
    }));
    const invoice = await getBookingInvoice("BK-1", { userId: "staff", connectionId: "connection" });
    expect(invoice.customerPhone).toBe(booking.user.phone);
    expect(mocks.page.setContent.mock.calls[0][0]).toContain(`<p>Phone: ${booking.user.phone}</p>`);
  });
});
