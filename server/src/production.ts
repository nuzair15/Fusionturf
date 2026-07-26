import { execSync } from "child_process";
import path from "path";

// Sync database schema before starting the server
console.log("⏳ Syncing database schema...");
try {
  execSync("npx prisma db push --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });
  console.log("✅ Schema sync complete");
} catch (error) {
  console.error("⚠️ Schema sync failed, continuing anyway:", error);
}

// Start the main server
import "./index.js";
