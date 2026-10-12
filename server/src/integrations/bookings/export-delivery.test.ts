import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rmdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const connection = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("../../config/database.js", () => ({ default: { mcpConnection: connection } }));
import { config } from "../../config/index.js";
import { readBookingImage, storeBookingImage, storeInvoicePdf, verifyExportDelivery } from "./files.js";
import { exportLifetimeSeconds } from "./delivery.js";

const png = Buffer.from("89504e470d0a1a0a0000000049454e44ae426082", "hex");
const owner = { userId: "staff", connectionId: "connection" };
const headers = { "content-type": "image/png", "content-disposition": 'attachment; filename="calendar.png"' };
let directory: string, previousDirectory: string | undefined;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "fusion-export-test-"));
  previousDirectory = config.bookingsMcp.exportDirectory;
  config.bookingsMcp.exportDirectory = directory;
  connection.findFirst.mockResolvedValue({ scopes: ["bookings:read"], user: { isActive: true, role: "BOOKING_ADMIN" } });
});
afterEach(async () => {
  config.bookingsMcp.exportDirectory = previousDirectory;
  vi.unstubAllGlobals(); vi.useRealTimers();
  for (const folder of await readdir(directory)) {
    const full = path.join(directory, folder);
    for (const file of await readdir(full)) await unlink(path.join(full, file));
    await rmdir(full);
  }
  await rmdir(directory);
});

describe("verified export delivery", () => {
  it("returns a stored, downloadable PNG only after verifying the public bytes", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(png, { headers }));
    vi.stubGlobal("fetch", fetchMock);
    const file = await storeBookingImage(png, "calendar", owner);
    expect(file).toMatchObject({ size: png.length, sha256: createHash("sha256").update(png).digest("hex"), mimeType: "image/png" });
    expect(Date.parse(file.expiresAt) - Date.parse(file.verifiedAt)).toBeGreaterThan((exportLifetimeSeconds - 2) * 1000);
    expect(fetchMock.mock.calls[0][0]).toBe(file.downloadUrl);
    const url = new URL(file.downloadUrl);
    expect(url.searchParams.get("download")).toBe("1");
    const id = url.pathname.split("/").at(-2)!;
    expect((await readBookingImage(id, file.fileName, url.searchParams.get("token")!)).bytes).toEqual(png);
    connection.findFirst.mockResolvedValue(null);
    await expect(readBookingImage(id, file.fileName, url.searchParams.get("token")!)).rejects.toThrow("revoked");
  });
  it("retains valid links during cleanup and removes files older than their lifetime plus grace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(png, { headers })));
    const file = await storeBookingImage(png, "first", owner);
    const folder = path.join(directory, "bookings-images"), stored = path.join(folder, new URL(file.url).pathname.split("/").at(-2)! + ".png");
    const recent = new Date(Date.now() - 2 * 60 * 60_000);
    await utimes(stored, recent, recent);
    const expired = path.join(folder, "b".repeat(32) + ".png");
    await writeFile(expired, png);
    const old = new Date(Date.now() - 26 * 60 * 60_000);
    await utimes(expired, old, old);
    await storeBookingImage(png, "second", owner);
    expect((await stat(stored)).size).toBe(png.length);
    await expect(stat(expired)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("does not return a link and removes the stored file when the endpoint is broken", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("login", { headers: { "content-type": "text/html" } })));
    await expect(storeBookingImage(png, "broken", owner)).rejects.toThrow("expected file");
    expect(await readdir(path.join(directory, "bookings-images"))).toEqual([]);
  });
  it("checks PDF delivery too", async () => {
    const pdf = Buffer.from("%PDF-1.7 test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(pdf, { headers: { ...headers, "content-type": "application/pdf" } })));
    expect((await storeInvoicePdf(pdf, "invoice", owner)).size).toBe(pdf.length);
  });
  it("retries a transient network or server failure once", async () => {
    for (const failure of [new Error("offline"), new Response("busy", { status: 503 })]) {
      const request = vi.fn();
      if (failure instanceof Error) request.mockRejectedValueOnce(failure);
      else request.mockResolvedValueOnce(failure);
      request.mockResolvedValueOnce(new Response(png, { headers }));
      vi.stubGlobal("fetch", request);
      await verifyExportDelivery("https://fusionturf.in/export", png, "image/png");
      expect(request).toHaveBeenCalledTimes(2);
    }
  });
  it("rejects wrong bytes, oversized bodies, inline responses and revoked links", async () => {
    for (const response of [new Response(Buffer.alloc(png.length), { headers }), new Response(Buffer.alloc(png.length + 1), { headers }), new Response(png, { headers: { ...headers, "content-disposition": "inline" } }), new Response("revoked", { status: 401 })]) {
      const request = vi.fn().mockResolvedValue(response);
      vi.stubGlobal("fetch", request);
      await expect(verifyExportDelivery("https://fusionturf.in/export", png, "image/png")).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it("bounds a persistent network failure and rejects invalid generated files", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", request);
    await expect(storeBookingImage(png, "broken", owner)).rejects.toThrow("temporarily unreachable");
    expect(request).toHaveBeenCalledTimes(2);
    await expect(storeBookingImage(Buffer.from("not PNG"), "bad", owner)).rejects.toThrow("valid image");
  });
});
