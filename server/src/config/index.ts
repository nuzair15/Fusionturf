import dotenv from "dotenv";
dotenv.config();

const fallbackDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/fusion_league";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = fallbackDatabaseUrl;
}

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000,https://fusion-league-client.onrender.com,https://www.fusionturf.in,https://fusionturf.in")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  database: {
    url: process.env.DATABASE_URL || fallbackDatabaseUrl,
  },

  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-change-in-production"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-only-mfa-key",
  requirePrivilegedMfa: process.env.REQUIRE_PRIVILEGED_MFA !== "false",

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.sendgrid.net",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "noreply@fusionturf.com",
    adminBookingEmail: process.env.ADMIN_BOOKING_EMAIL || "",
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || "",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "500", 10),
  },

  // Actual API payloads here (bookings, admin forms, league data) are all
  // small JSON objects — file uploads go through the separate multipart
  // /api/upload route with its own 5MB multer limit, not this one. A
  // generous body limit only matters as a worst-case: how much memory a
  // handful of concurrent large requests can force the process to buffer
  // before rejecting them. 1mb is comfortably above any real payload this
  // app sends while capping that worst case on a small instance.
  bodyLimit: process.env.BODY_LIMIT || "1mb",
};
