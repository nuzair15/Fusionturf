import sanitizeHtml from "sanitize-html";
import { AppError } from "../middleware/errorHandler.js";

const SAFE_TAGS = [
  "p", "br", "strong", "em", "u", "s", "blockquote", "ul", "ol", "li",
  "h2", "h3", "h4", "a", "code", "pre",
];

/** Sanitize rich text at the write boundary so every current and future client is safe. */
export function sanitizeRichText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return sanitizeHtml(String(value), {
    allowedTags: SAFE_TAGS,
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "noopener noreferrer nofollow",
          ...(attribs.target === "_blank" ? { target: "_blank" } : {}),
        },
      }),
    },
  }).trim();
}

/** Only browser-safe web/relative URLs are accepted; executable schemes are rejected. */
export function assertSafeUrl(value: unknown, field: string, options: { allowMailto?: boolean } = {}): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const parsed = new URL(text);
    const allowed = options.allowMailto ? ["http:", "https:", "mailto:"] : ["http:", "https:"];
    if (!allowed.includes(parsed.protocol)) throw new Error("unsafe scheme");
    return parsed.toString();
  } catch {
    throw new AppError(`${field} must be a safe http(s)${options.allowMailto ? " or mailto" : ""} URL`, 400, "UNSAFE_URL");
  }
}

