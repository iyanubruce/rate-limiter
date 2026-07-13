import { getSharedRedis } from "./services/redis";
import { createTrafficServer } from "./trafficServer";
import logger from "./utils/logger";
import { trafficDb as db } from "./config/traffic-database";
import { sql } from "drizzle-orm";

async function startTrafficServer() {
  try {
    const redisClient = getSharedRedis();
    await redisClient.connect();

    await db.execute(sql`SELECT 1`);
    logger.info("✓ Database connected successfully");

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
