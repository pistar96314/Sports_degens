import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import { connectDatabase } from "./config/database";
import { getEnv } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import { createDirectories } from "./utils/createDirectories";

import baseRoutes from "./routes";
import authRoutes from "./routes/auth";
import sportsToolsRoutes from "./routes/sports-tools";
import paymentRoutes from "./routes/payment";
import casinoRoutes from "./routes/casino";

// Load environment variables (local dev)
// In local development it's common for Windows/user env vars to be set (sometimes empty).
// `override: true` ensures values from the project's .env file are used.
dotenv.config({ override: true });

console.log("ODDS_API_KEY:   ", JSON.stringify(process.env.ODDS_API_KEY));

// Validate env early (fail fast)
const env = getEnv();

// Create necessary directories
createDirectories();

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL || "*",
    credentials: true,
  })
);

// Stripe webhook needs raw body; the payment router applies express.raw on /webhook
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Simple request logging (path + method)
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api", baseRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sports-tools", sportsToolsRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/casino", casinoRoutes);

// Error handler (last)
app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    logger.info("Database connected successfully");

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
