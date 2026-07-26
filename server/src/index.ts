import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));

// Rate limiting
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { error: "Too many requests, please try again later" },
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

// API Routes
app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
  });
}

export default app;
