import { execSync } from "child_process";
import path from "path";

// Sync database schema (timeout-safe) before starting the server
console.log("⏳ Syncing database schema...");
try {
  execSync("npx prisma db push --accept-data-loss --skip-generate", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
    timeout: 30000,
  });
  console.log("✅ Schema sync complete");
} catch (error: any) {
  if (error.timedOut) {
    console.error("⚠️ Schema sync timed out, continuing anyway");
  } else {
    console.error("⚠️ Schema sync failed, continuing anyway:", error.message || error);
  }
}

// Start the main server
import "./index.js";
