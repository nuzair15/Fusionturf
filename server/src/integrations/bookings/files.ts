import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { BOOKING_ROLES, integrationBase, publicOrigin } from "./auth.js";

const audience = "fusion-booking-invoice-download";
// Download capabilities must never validate as website login credentials.
const downloadKey = () => createHmac("sha256", config.jwt.secret).update(audience).digest("hex");
const cacheDirectory = () => path.resolve(".cache", "bookings-invoices");
const claimsSchema = z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), fileName: z.string().regex(/^[A-Za-z0-9_-]{1,140}\.pdf$/), userId: z.string().min(1), connectionId: z.string().min(1), exp: z.number() });
export type InvoiceFileOwner = { userId: string; connectionId: string };

export function signInvoiceDownload(id: string, fileName: string, owner: InvoiceFileOwner) {
  return jwt.sign({ id, fileName, ...owner }, downloadKey(), { algorithm: "HS256", audience, issuer: publicOrigin, expiresIn: "15m" });
}

export function verifyInvoiceDownload(id: string, fileName: string, token: string) {
  try {
    const claims = claimsSchema.parse(jwt.verify(token, downloadKey(), { algorithms: ["HS256"], audience, issuer: publicOrigin }));
    if (claims.id !== id || claims.fileName !== fileName) throw new Error("File mismatch");
    return claims;
  } catch { throw new AppError("This invoice link is invalid or expired. Request a fresh invoice in ChatGPT.", 401); }
}

export async function storeInvoicePdf(pdf: Buffer, bookingNumber: string, owner: InvoiceFileOwner) {
  if (pdf.length > 5 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== "%PDF-") throw new AppError("Could not create a valid invoice PDF", 500);
  const directory = cacheDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const entries = (await readdir(directory)).filter(name => /^[a-f0-9]{32}\.pdf$/.test(name));
  let retained = 0;
  for (const entry of entries) {
    const file = path.join(directory, entry);
    try {
      if ((await stat(file)).mtimeMs < Date.now() - 60 * 60_000) await unlink(file);
      else retained += 1;
    } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
  }
  if (retained >= 500) throw new AppError("Invoice exports are busy. Try again later.", 429);
  const id = randomBytes(16).toString("hex");
  const reference = bookingNumber.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 125) || "booking";
  const fileName = `invoice-${reference}.pdf`;
  await writeFile(path.join(directory, `${id}.pdf`), pdf, { flag: "wx", mode: 0o600 });
  const token = signInvoiceDownload(id, fileName, owner);
  const claims = verifyInvoiceDownload(id, fileName, token);
  const url = new URL(`${integrationBase}/files/${id}/${fileName}`, publicOrigin);
  url.searchParams.set("token", token);
  return { url: url.href, fileName, mimeType: "application/pdf" as const, size: pdf.length, expiresAt: new Date(claims.exp * 1000).toISOString() };
}

export async function readInvoicePdf(id: string, fileName: string, token: string, expectedUserId?: string) {
  const claims = verifyInvoiceDownload(id, fileName, token);
  if (expectedUserId && claims.userId !== expectedUserId) throw new AppError("This invoice belongs to a different connected account", 403);
  const connection = await prisma.mcpConnection.findFirst({ where: { id: claims.connectionId, userId: claims.userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } }, include: { user: { select: { isActive: true, role: true } } } });
  if (!connection?.user.isActive || !BOOKING_ROLES.includes(connection.user.role) || !connection.scopes.includes("bookings:read")) throw new AppError("Invoice access was revoked. Reconnect your booking staff account.", 401);
  const file = path.join(cacheDirectory(), `${claims.id}.pdf`);
  try {
    const metadata = await stat(file);
    if (metadata.size > 5 * 1024 * 1024) throw new AppError("Invoice file is unavailable", 404);
    return { bytes: await readFile(file), fileName: claims.fileName };
  } catch (error: any) {
    if (error?.code === "ENOENT") throw new AppError("This invoice file expired. Request a fresh invoice in ChatGPT.", 404);
    throw error;
  }
}
