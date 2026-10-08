import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { signImageDownload, verifyImageDownload, verifyInvoiceDownload } from "./files.js";

describe("booking image download capabilities", () => {
  const id = "a".repeat(32), name = "image-calendar.png", owner = { userId: "staff", connectionId: "connection" };
  it("binds a PNG to its exact path and isolates it from invoice and login credentials", () => {
    const token = signImageDownload(id, name, owner);
    expect(verifyImageDownload(id, name, token)).toMatchObject(owner);
    for (const [fileId, fileName] of [[id, "different.png"], ["../file", name], [id, "../../calendar.png"]]) expect(() => verifyImageDownload(fileId, fileName, token)).toThrow();
    expect(() => verifyImageDownload(id, name, token + "tampered")).toThrow();
    expect(() => verifyInvoiceDownload(id, name.replace(".png", ".pdf"), token)).toThrow();
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });
  it("expires after fifteen minutes", () => {
    vi.useFakeTimers();
    try {
      const token = signImageDownload(id, name, owner);
      vi.setSystemTime(Date.now() + 16 * 60_000);
      expect(() => verifyImageDownload(id, name, token)).toThrow("expired");
    } finally { vi.useRealTimers(); }
  });
});
