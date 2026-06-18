import { Worker, Queue } from "bullmq";
import config from "../config/env";
import RateLimitRepository from "../database/repositories/rate-limit-events";
import { trafficDb as db } from "../config/traffic-database";
import { sql } from "drizzle-orm";
import logger from "../utils/logger";

console.log("👷 Analytics background worker is active...");
await db.execute(sql`SELECT 1`);
logger.info("✓ Database connected successfully");

const rateLimitRepo = new RateLimitRepository(db);

const worker = new Worker(
  "analytics-logs",
  async (job) => {
    const {
      time,
      tenantId,
      apiKeyId,
      ipAddress,
      endpoint,
      method,
      userAgent,
      statusCode,
      requestDurationMs,
      responseSize,
      isBlocked,
      remainingQuota,
    } = job.data;

    await rateLimitRepo.createRateLimitEvent({
      time: new Date(time),
      tenantId,
      apiKeyId,
      ipAddress,
      endpoint,
      method,
      userAgent,
      statusCode,
      requestDurationMs,
      responseSize,
      isBlocked,
      remainingQuota,
    });
  },

  {
    connection: config.redis,
    concurrency: 5,
  },
);

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} logging failure:`, err.message);
});
