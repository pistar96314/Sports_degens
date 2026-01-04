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

import affiliateRoutes from "./routes/affiliate";
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
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  })
);

// Stripe webhook needs raw body for signature verification
// Must be before express.json() middleware
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

// JSON body parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logging (path + method)
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});
// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// API Routes

app.use("/api/auth", authRoutes);
app.use("/api/sports-tools", sportsToolsRoutes);
app.use("/api/casino", casinoRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/affiliate", affiliateRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info("Database connected successfully");
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(
        `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
