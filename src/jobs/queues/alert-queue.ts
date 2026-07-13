import { Queue } from "bullmq";
import env from "../../config/env";
import type { AlertInsert } from "../../database/models/alerts";

export interface AlertWebhookPayload {
  alert: AlertInsert & { id?: number };
  tenantId: string;
}

export const alertWebhookQueue = new Queue<AlertWebhookPayload>(
  "alert-webhooks",
  {
    connection: {
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password,
    },
    defaultJobOptions: {
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400, count: 500 },
      attempts: 1,
    },
  },
);
