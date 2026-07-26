import { execSync } from "child_process";
import path from "path";

// Run database migrations before starting the server
console.log("⏳ Running database migrations...");
try {
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });
  console.log("✅ Migrations complete");
} catch (error) {
  console.error("⚠️ Migration failed, continuing anyway:", error);
}

// Start the main server
import "./index";
