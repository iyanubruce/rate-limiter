import { Redis } from "ioredis";
import { createTrafficServer } from "./trafficServer";
import logger from "./utils/logger";
import config from "./config/env";

async function startTrafficServer() {
  try {
    const redisClient = new Redis(config.redis);

    await new Promise<void>((resolve, reject) => {
      redisClient.on("ready", () => {
        logger.info("✓ Redis connected");
        resolve();
      });

      redisClient.on("error", (err) => {
        logger.error("Redis connection error:", err);
        reject(err);
      });
    });

    const server = createTrafficServer();
    Bun.serve(server);

    logger.info(
      `🚀 Bun Traffic Server listening on port ${process.env.TRAFFIC_PORT || 3001}`,
    );
  } catch (error) {
    logger.error(
      `💀 Fatal: Failed to start traffic server ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

startTrafficServer();
