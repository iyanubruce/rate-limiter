import { createBunServer as createServer } from "./server";
import config from "./config/env";
import { RedisClient } from "./services/redis";
import { DatabaseClient } from "./services/database";
import logger from "./utils/logger";

const PORT = config.server.port;
const HOST = config.server.host;

let redisClient: RedisClient;
let dbClient: DatabaseClient;
let server: any;

async function startServer() {
  try {
    // Initialize services
    logger.info("Initializing services...");

    redisClient = new RedisClient(config.redis);
    await redisClient.connect();
    logger.info("✓ Redis connected");

    dbClient = new DatabaseClient(config.database);
    await dbClient.connect();
    logger.info("✓ Database connected");

    // Create and start server
    server = await createServer(redisClient, dbClient);

    logger.info(`🚀 RateLimitr running on http://${HOST}:${PORT}`);
    logger.info(`📡 Environment: ${config.server.env}`);
    logger.info(`📚 API Docs: http://${HOST}:${PORT}/docs`);
    logger.info(`🔌 WebSocket: ws://${HOST}:${PORT}/ws`);
  } catch (error) {
    logger.error(
      `💀 Fatal: Failed to start server ${error instanceof Error ? error : String(error)}`,
    );
    process.exit(1);
  }
}

// Error handlers
server?.on?.("error", (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") throw error;

  const bind = typeof PORT === "string" ? `Pipe ${PORT}` : `Port ${PORT}`;

  switch (error.code) {
    case "EACCES":
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, starting graceful shutdown...");
  await gracefulShutdown();
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, starting graceful shutdown...");
  await gracefulShutdown();
});

process.on("uncaughtException", (error) => {
  logger.error(
    `Uncaught exception: ${error instanceof Error ? error : String(error)}`,
  );
  gracefulShutdown().then(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  logger.error(
    `Unhandled rejection: ${reason instanceof Error ? reason : String(reason)}`,
  );
  gracefulShutdown().then(() => process.exit(1));
});

async function gracefulShutdown() {
  try {
    if (server?.stop) {
      server.stop();
      logger.info("✓ Server stopped");
    }

    if (dbClient) {
      await dbClient.disconnect();
      logger.info("✓ Database disconnected");
    }

    if (redisClient) {
      await redisClient.disconnect();
      logger.info("✓ Redis disconnected");
    }

    logger.info("🔌 Server closed");
    process.exit(0);
  } catch (error) {
    logger.error(
      `Error during shutdown: ${error instanceof Error ? error : String(error)}`,
    );
    process.exit(1);
  }
}

// Start the server
startServer();
