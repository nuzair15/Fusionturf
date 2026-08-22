import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import multer from "multer";
import cloudinary from "./lib/cloudinary.js";
import { config } from "./config/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authenticate, authorize } from "./middleware/auth.js";
import routes from "./routes/index.js";
import prisma from "./config/database.js";
import { startOutboxWorker, stopOutboxWorker } from "./services/outbox.js";
import { randomUUID } from "crypto";
import { csrfProtection } from "./middleware/csrf.js";

if (config.nodeEnv === "production") {
  const required = ["DATABASE_URL", "JWT_SECRET", "MFA_ENCRYPTION_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
}

// SVG is deliberately NOT in this list. SVG is XML and can carry
// <script>/event-handler payloads — allowing it here would let a
// trusted-but-compromised uploader account (or a mismatched-content file
// smuggled past extension checks) plant a stored-XSS payload served from
// this origin/Cloudinary.
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

// Real file-content signatures ("magic bytes") for the same set of formats.
// Extension checks alone can be bypassed by simply renaming any file, so
// every upload is also sniffed by its actual bytes before it's accepted.
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = "." + file.originalname.toLowerCase().split(".").pop();
    cb(null, ALLOWED_IMAGE_EXTENSIONS.includes(ext));
  },
});

const app = express();

app.use((req, res, next) => {
  const requestId = req.header("X-Request-Id")?.slice(0, 128) || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// Trust proxy (Nginx)
app.set("trust proxy", 1);

// Security
app.use(helmet());
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = config.corsOrigin;
    if (!origin || allowed === "*" || (Array.isArray(allowed) ? allowed.includes(origin) : allowed === origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// gzip API responses. JSON payloads (fixtures, standings, league lists)
// compress very well, and shrinking what actually goes over the wire
// matters more on a small, likely bandwidth/CPU-constrained EC2 instance
// than the small amount of CPU compression costs — express's compression
// default threshold (1kb) already skips it for tiny responses where it
// wouldn't help.
app.use(compression());

// Global rate limit — a coarse backstop. Endpoints that are meaningfully
// more sensitive (auth, admin login, booking creation) get their own
// tighter limiter below, since a 500-req/15min global ceiling does very
// little to slow down a credential-stuffing or double-booking script that
// targets one specific route.
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { error: "Too many requests, please try again later" },
  })
);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

// Body parsing
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));
app.use(csrfProtection);

// Logging. "dev" is fine for local work but builds a colorized string per
// request; "tiny" in production keeps request logging (still useful for
// debugging on a single small instance) without the extra formatting work.
if (config.nodeEnv !== "test") {
  app.use(morgan(config.nodeEnv === "production" ? "tiny" : "dev"));
}

app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);
app.use("/api/auth/mfa", authRateLimit);

// Upload endpoint
app.post("/api/upload", authenticate, authorize("SUPER_ADMIN", "LEAGUE_ADMIN", "CONTENT_EDITOR"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!detectImageType(req.file.buffer)) {
      return res.status(400).json({ error: "File content does not match a supported image format" });
    }
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "fusion-turf", resource_type: "image" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      uploadStream.end(req.file!.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// A rejected promise or thrown error with no handler anywhere in the chain
// otherwise crashes the process with no log line explaining why, which on
// Render shows up as "the API just restarted" with no diagnostic trail.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // An exception that escaped every try/catch means the process is in an
  // unknown state — exit and let the platform (Render/Docker) restart it
  // cleanly rather than keep serving requests from a possibly-corrupted state.
  process.exit(1);
});

// Start server
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
    startOutboxWorker();
  });

  // On deploy/restart, Render (and Docker) send SIGTERM and expect the
  // process to finish in-flight requests and close cleanly within a grace
  // period — not be killed mid-request. Without this, Prisma's connection
  // pool is torn down abruptly on every deploy, which shows up as sporadic
  // "connection closed" errors on whichever requests were in flight.
  const shutdown = (signal: string) => {
    console.log(`${signal} received: closing server gracefully`);
    stopOutboxWorker();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Force-exit if close() hangs (e.g. a long-lived connection never ends).
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export default app;
