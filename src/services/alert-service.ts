import env from "../config/env";
import { trafficDb } from "../config/traffic-database";
import AlertRepository from "../database/repositories/alerts";
import { alertWebhookQueue } from "../jobs/queues/alert-queue";
import { getSharedRedis } from "../services/redis";
import logger from "../utils/logger";

const alertRepo = new AlertRepository(trafficDb);
const redis = getSharedRedis();

export async function checkAndTriggerQuotaWarning(
  tenantId: string,
  userId: number,
  remaining: number,
  quota: number,
): Promise<void> {
  const threshold = env.alerts.quotaWarningThreshold;
  const remainingPercent = (remaining / quota) * 100;

  if (remainingPercent > threshold) return;

  try {
    const cooldownKey = `alert:cooldown:quota_warning:${tenantId}`;
    const set = await redis.client.set(cooldownKey, "1", "EX", 3600, "NX");
    if (set !== "OK") return;

    const alertRecord = await alertRepo.create({
      tenantId,
      userId,
      name: `Quota Warning - ${Math.round(remainingPercent)}% remaining`,
      channel: "webhook",
      type: "quota_warning",
      threshold,
      config: {
        remaining,
        quota,
        remainingPercent: Math.round(remainingPercent),
      },
      isActive: true,
    });

    if (!alertRecord) return;

    await alertWebhookQueue.add("deliver", {
      alert: alertRecord,
      tenantId,
    });
  } catch (error) {
    logger.error({ event: "quota_warning_trigger_failed", error, tenantId });
  }
}
