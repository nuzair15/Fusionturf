import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, mcpConnection: { findUnique: vi.fn(), updateMany: vi.fn() }, mcpGrant: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() }, mcpClient: { create: vi.fn(), findUnique: vi.fn() }, $transaction: vi.fn() }));
vi.mock("../../config/database.js", () => ({ default: mocks }));
import { allowedRedirect, BookingOAuthProvider, resourceUrl } from "./auth.js";
import { calendarHtml } from "./images.js";
import { bookingSummary, canonicalJson, validateRange } from "./tools.js";

describe("private booking plugin boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("allows ChatGPT callbacks and rejects arbitrary external redirects", () => {
    expect(allowedRedirect("https://chatgpt.com/connector/oauth/test_callback")).toBe(true);
    expect(allowedRedirect("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    for (const uri of ["https://evil.example/callback", "https://chatgpt.com.evil.example/connector/oauth/test", "https://chatgpt.com/elsewhere", "https://user@chatgpt.com/connector/oauth/test"]) expect(allowedRedirect(uri)).toBe(false);
  });
  it("rejects expired, revoked and wrong-audience tokens", async () => {
    const provider = new BookingOAuthProvider();
    for (const row of [null, { revokedAt: new Date() }, { accessExpiresAt: new Date(0) }, { accessExpiresAt: new Date(Date.now() + 10000), resource: "https://wrong.example/mcp" }]) {
      mocks.mcpConnection.findUnique.mockResolvedValue(row);
      await expect(provider.verifyAccessToken("opaque-token")).rejects.toThrow();
    }
    expect(mocks.user.findUnique).not.toHaveBeenCalled();
  });
  it("uses the current staff role and deactivation state on every call", async () => {
    mocks.mcpConnection.findUnique.mockResolvedValue({ accessExpiresAt: new Date(Date.now() + 10000), resource: resourceUrl, userId: "staff", scopes: ["bookings:read"], clientId: "client", id: "connection" });
    mocks.user.findUnique.mockResolvedValue({ id: "staff", isActive: true, role: "BOOKING_ADMIN" });
    const provider = new BookingOAuthProvider();
    expect((await provider.verifyAccessToken("opaque-token")).extra.role).toBe("BOOKING_ADMIN");
    mocks.user.findUnique.mockResolvedValue({ id: "staff", isActive: true, role: "CUSTOMER" });
    await expect(provider.verifyAccessToken("opaque-token")).rejects.toThrow("revoked");
    mocks.user.findUnique.mockResolvedValue({ id: "staff", isActive: false, role: "BOOKING_ADMIN" });
    await expect(provider.verifyAccessToken("opaque-token")).rejects.toThrow("revoked");
  });
  it("rejects attempts to upgrade a read-only connection through refresh", async () => {
    mocks.mcpConnection.findUnique.mockResolvedValue({ clientId: "client", resource: resourceUrl, scopes: ["bookings:read"], userId: "staff", refreshExpiresAt: new Date(Date.now() + 10000) });
    mocks.user.findUnique.mockResolvedValue({ id: "staff", isActive: true, role: "BOOKING_ADMIN" });
    await expect(new BookingOAuthProvider().exchangeRefreshToken({ client_id: "client" } as any, "refresh", ["bookings:write"], new URL(resourceUrl))).rejects.toThrow("extra permissions");
    expect(mocks.mcpConnection.updateMany).not.toHaveBeenCalled();
  });
  it("does not exchange consumed authorization codes", async () => {
    mocks.mcpGrant.findUnique.mockResolvedValue({ clientId: "client", consumedAt: new Date(), userId: "staff", expiresAt: new Date(Date.now() + 10000) });
    await expect(new BookingOAuthProvider().challengeForAuthorizationCode({ client_id: "client" } as any, "used-code")).rejects.toThrow("invalid or expired");
  });
  it("omits customer information from public images and escapes staff labels", () => {
    const bookings = [{ date: new Date("2030-01-01"), startTime: "08:00", endTime: "09:00", status: "CONFIRMED", customerName: "Private <script>alert(1)</script>", turf: { name: "Turf <1>" } }];
    const venue = { name: "Venue <2>", timezone: "Asia/Kolkata" };
    const publicImage = calendarHtml(venue, "2030-01-01", "2030-01-01", bookings, "public");
    expect(publicImage).not.toContain("Private");
    const staffImage = calendarHtml(venue, "2030-01-01", "2030-01-01", bookings, "staff");
    expect(staffImage).toContain("Private &lt;script&gt;");
    expect(staffImage).not.toContain("<script>");
  });
  it("does not expose guest-management credentials in booking results", () => {
    const result = bookingSummary({ id: "booking", date: new Date("2030-01-01"), guestTokenHash: "secret", idempotencyKey: "secret", guestManagementToken: "secret", customerName: "Ahmed" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.customerName).toBe("Ahmed");
  });
  it("bounds images to valid ranges and canonicalizes reordered retry inputs", () => {
    expect(() => validateRange("2030-01-02", "2030-01-01", 31)).toThrow();
    expect(() => validateRange("2030-01-01", "2030-02-01", 31)).toThrow();
    expect(() => validateRange("2030-01-01", "2030-01-31", 31)).not.toThrow();
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
  });
});
