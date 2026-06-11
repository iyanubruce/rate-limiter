// src/traffic/services/queue.ts
import { Queue } from "bullmq";
import config from "../../config/env";
import type { RateLimitLogPayload } from "../../interfaces/rate-limit-events";
export const ratelimitEventQueue = new Queue<
  RateLimitLogPayload,
  any,
  "log-event"
>("analytics-logs", {
  connection: {
    host: config.redis.host || "localhost",
    port: config.redis.port || 6379,
    password: config.redis.password,
  },
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400, count: 5000 },
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});
