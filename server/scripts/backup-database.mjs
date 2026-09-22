import "dotenv/config";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";

const output = process.argv[2];
const connection = process.env.DATABASE_URL;
if (!output || !connection) {
  console.error("Usage: node scripts/backup-database.mjs /absolute/path/backup.dump (DATABASE_URL required)");
  process.exit(1);
}

let url;
try { url = new URL(connection); }
catch { console.error("DATABASE_URL is invalid"); process.exit(1); }
if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
  console.error("DATABASE_URL must name a PostgreSQL database");
  process.exit(1);
}

// Pass credentials through the process environment, never through pg_dump's
// command line or shell output where another local user could see them.
const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
};
const sslMode = url.searchParams.get("sslmode");
if (sslMode) pgEnv.PGSSLMODE = sslMode;
const backup = spawnSync("pg_dump", ["--format=custom", "--file", output], { env: pgEnv, stdio: "inherit" });
if (backup.error || backup.status !== 0) {
  console.error(backup.error?.message || `pg_dump failed with exit code ${backup.status}`);
  process.exit(1);
}
if (statSync(output).size === 0) {
  console.error("Backup file is empty");
  process.exit(1);
}
console.log(`Backup saved: ${output}`);
