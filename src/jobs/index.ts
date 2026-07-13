import { Worker } from "bullmq";
import config from "../config/env";
import RateLimitRepository from "../database/repositories/rate-limit-events";
import WebhookRepository from "../database/repositories/webhooks";
import { trafficDb as db } from "../config/traffic-database";
import { sql } from "drizzle-orm";
import logger from "../utils/logger";
import { checkAndTriggerQuotaWarning } from "../services/alert-service";

console.log("👷 Analytics background worker is active...");
await db.execute(sql`SELECT 1`);
logger.info("✓ Database connected successfully");

const rateLimitRepo = new RateLimitRepository(db);

const analyticsWorker = new Worker(
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

analyticsWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} logging failure:`, err.message);
});

console.log("👷 Alert webhook worker is active...");

const webhookRepo = new WebhookRepository(db);

const webhookWorker = new Worker(
  "alert-webhooks",
  async (job) => {
    const { alert, tenantId } = job.data;

    const webhooks = await webhookRepo.findActiveByUserIds([alert.userId]);
    if (webhooks.length === 0) return;

    const payload = {
      type: "quota_warning",
      alert: {
        id: alert.id,
        name: alert.name,
        type: alert.type,
        threshold: alert.threshold,
        config: alert.config,
      },
      tenantId,
      timestamp: Date.now(),
    };

    const results = await Promise.allSettled(
      webhooks.map((wh) =>
        fetch(wh.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(wh.headers as Record<string, string>),
            ...(wh.secret ? { "X-Webhook-Secret": wh.secret } : {}),
          },
          body: JSON.stringify(payload),
        }),
      ),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn({
          event: "webhook_delivery_failed",
          error: result.reason?.message ?? result.reason,
        });
      }
    }
  },

  {
    connection: config.redis,
    concurrency: 3,
  },
);

webhookWorker.on("failed", (job, err) => {
  logger.warn({
    event: "webhook_worker_failed",
    error: err.message,
    jobId: job?.id,
  });
});

console.log("👷 Alert check worker is active...");

const alertCheckWorker = new Worker(
  "alert-check",
  async (job) => {
    const { tenantId, userId, remaining, quota } = job.data;
    await checkAndTriggerQuotaWarning(tenantId, userId, remaining, quota);
  },
  {
    connection: config.redis,
    concurrency: 3,
  },
);

alertCheckWorker.on("failed", (job, err) => {
  logger.warn({
    event: "alert_check_worker_failed",
    error: err.message,
    jobId: job?.id,
  });
});
