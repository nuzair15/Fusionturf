import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/database.js";
import { config } from "../../config/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import { BOOKING_ROLES, integrationBase, publicOrigin } from "./auth.js";

function fileStore(kind: "invoice" | "image", extension: "pdf" | "png", mimeType: string) {
  const audience = `fusion-booking-${kind}-download`;
  // Download capabilities must never validate as website login credentials.
  const downloadKey = () => createHmac("sha256", config.jwt.secret).update(audience).digest("hex");
  const cacheDirectory = () => path.resolve(".cache", `bookings-${kind}s`);
  const claimsSchema = z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), fileName: z.string().regex(new RegExp(`^[A-Za-z0-9_-]{1,140}\\.${extension}$`)), userId: z.string().min(1), connectionId: z.string().min(1), exp: z.number() });

  function sign(id: string, fileName: string, owner: InvoiceFileOwner) {
    return jwt.sign({ id, fileName, ...owner }, downloadKey(), { algorithm: "HS256", audience, issuer: publicOrigin, expiresIn: "15m" });
  }

  function verify(id: string, fileName: string, token: string) {
    try {
      const claims = claimsSchema.parse(jwt.verify(token, downloadKey(), { algorithms: ["HS256"], audience, issuer: publicOrigin }));
      if (claims.id !== id || claims.fileName !== fileName) throw new Error("File mismatch");
      return claims;
    } catch { throw new AppError(`This ${kind} link is invalid or expired. Request a fresh ${kind} in ChatGPT.`, 401); }
  }

  async function store(bytes: Buffer, referenceName: string, owner: InvoiceFileOwner) {
    const valid = extension === "pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
    if (bytes.length > 5 * 1024 * 1024 || !valid) throw new AppError(`Could not create a valid ${kind} file`, 500);
    const directory = cacheDirectory();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const entries = (await readdir(directory)).filter(name => new RegExp(`^[a-f0-9]{32}\\.${extension}$`).test(name));
    let retained = 0;
    for (const entry of entries) {
      const file = path.join(directory, entry);
      try {
        if ((await stat(file)).mtimeMs < Date.now() - 60 * 60_000) await unlink(file);
        else retained += 1;
      } catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    if (retained >= 500) throw new AppError("File exports are busy. Try again later.", 429);
    const id = randomBytes(16).toString("hex");
    const reference = referenceName.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 125) || "booking";
    const fileName = `${kind}-${reference}.${extension}`;
    await writeFile(path.join(directory, `${id}.${extension}`), bytes, { flag: "wx", mode: 0o600 });
    const token = sign(id, fileName, owner);
    const claims = verify(id, fileName, token);
    const url = new URL(`${integrationBase}/files/${id}/${fileName}`, publicOrigin);
    url.searchParams.set("token", token);
    return { url: url.href, fileName, mimeType, size: bytes.length, expiresAt: new Date(claims.exp * 1000).toISOString() };
  }

  async function read(id: string, fileName: string, token: string, expectedUserId?: string) {
    const claims = verify(id, fileName, token);
    if (expectedUserId && claims.userId !== expectedUserId) throw new AppError(`This ${kind} belongs to a different connected account`, 403);
    const connection = await prisma.mcpConnection.findFirst({ where: { id: claims.connectionId, userId: claims.userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } }, include: { user: { select: { isActive: true, role: true } } } });
    if (!connection?.user.isActive || !BOOKING_ROLES.includes(connection.user.role) || !connection.scopes.includes("bookings:read")) throw new AppError("File access was revoked. Reconnect your booking staff account.", 401);
    const file = path.join(cacheDirectory(), `${claims.id}.${extension}`);
    try {
      const metadata = await stat(file);
      if (metadata.size > 5 * 1024 * 1024) throw new AppError("Invoice file is unavailable", 404);
      return { bytes: await readFile(file), fileName: claims.fileName, mimeType };
    } catch (error: any) {
      if (error?.code === "ENOENT") throw new AppError(`This ${kind} file expired. Request a fresh ${kind} in ChatGPT.`, 404);
      throw error;
    }
  }
  return { sign, verify, store, read };
}

export type InvoiceFileOwner = { userId: string; connectionId: string };
const invoices = fileStore("invoice", "pdf", "application/pdf");
const images = fileStore("image", "png", "image/png");
export const signInvoiceDownload = invoices.sign;
export const verifyInvoiceDownload = invoices.verify;
export const storeInvoicePdf = invoices.store;
export const readInvoicePdf = invoices.read;
export const signImageDownload = images.sign;
export const verifyImageDownload = images.verify;
export const storeBookingImage = images.store;
export const readBookingImage = images.read;
export const readBookingFile = (id: string, fileName: string, token: string, expectedUserId?: string) =>
  fileName.endsWith(".png") ? images.read(id, fileName, token, expectedUserId) : invoices.read(id, fileName, token, expectedUserId);
