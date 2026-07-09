import { Queue } from "bullmq";
import env from "../../config/env";

export interface AlertCheckPayload {
  tenantId: string;
  userId: number;
  remaining: number;
  quota: number;
}

export const alertCheckQueue = new Queue<AlertCheckPayload>(
  "alert-check",
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
