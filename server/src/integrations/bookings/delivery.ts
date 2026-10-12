import { z } from "zod";

export const exportLifetimeSeconds = 24 * 60 * 60;
export const fileDeliveryInstructions = "Use the exact HTTPS downloadUrl returned by this tool as the primary download link. This is a server-hosted file, not a file in your working environment. Never invent sandbox:/mnt/data links, local paths, or ChatGPT file IDs. Only offer a native attachment after downloading the exact bytes, verifying the size and SHA-256, and confirming that the host actually attached it. Keep the HTTPS link even when attaching a copy. Links last 24 hours, subject to staff access; regenerate an expired link by calling the same read-only tool with the same dates and audience. Do not describe a temporary URL as permanent or claim an unperformed verification.";

export const exportFileSchema = (mimeType: "image/png" | "application/pdf") => z.object({
  url: z.string().url(), downloadUrl: z.string().url(), fileName: z.string(), mimeType: z.literal(mimeType),
  size: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(), verifiedAt: z.string().datetime(),
});
