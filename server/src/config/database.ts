import { PrismaClient } from "@prisma/client";

// Prisma's connection pool defaults to `num_physical_cpus * 2 + 1`. On the
// small single-vCPU instances this app targets, that default is already
// close to right, but leaving it implicit means it silently scales up if
// the app ever moves to a bigger box — each pooled connection costs
// memory on both the Node process and Postgres. Pin it explicitly (and
// give Postgres a bounded wait instead of hanging) via connection-string
// params, without requiring everyone to remember to add them to
// DATABASE_URL by hand.
function withPoolLimits(url: string): string {
  const [base, existingQuery] = url.split("?");
  const params = new URLSearchParams(existingQuery);
  if (!params.has("connection_limit")) {
    params.set("connection_limit", process.env.DATABASE_POOL_SIZE || "5");
  }
  if (!params.has("pool_timeout")) {
    params.set("pool_timeout", "10");
  }
  return `${base}?${params.toString()}`;
}

// config/index.ts (imported before this module anywhere in the real app)
// always guarantees DATABASE_URL is set, falling back to a local dev
// default — this mirrors that same fallback so this module is also safe
// to import on its own (e.g. from a script or test that doesn't load
// config/index.ts first).
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fusion_league";

const prisma = new PrismaClient({
  datasources: {
    db: { url: withPoolLimits(databaseUrl) },
  },
  // "query" logging in development keeps every SQL statement (and its
  // params) resident long enough to print, which is fine locally but not
  // something you want accumulating in production log volume/memory.
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

export default prisma;
