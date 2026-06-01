import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import RateLimitService from "../../services/rate-limit-service";
import { trackRequest } from "../../services/metrics";
import type { FastifyReply, FastifyRequest } from "fastify";

const simulationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/v1/simulation/traffic",
    {
      schema: {
        body: {
          type: "object",
          required: ["identifier", "count"],
          properties: {
            identifier: { type: "string" },
            count: { type: "integer", minimum: 1, maximum: 10000 },
            delay: { type: "integer", minimum: 0, maximum: 1000, default: 0 },
            limit: { type: "integer", minimum: 1 },
            windowSeconds: { type: "integer", minimum: 1 },
            strategy: { type: "string", enum: ["token_bucket", "sliding_window", "leaky_bucket"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              total: { type: "integer" },
              allowed: { type: "integer" },
              blocked: { type: "integer" },
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" },
                    allowed: { type: "boolean" },
                    remaining: { type: "integer" },
                    durationMs: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = new RateLimitService(request.server.redis);
      const {
        identifier,
        count,
        delay,
        limit,
        windowSeconds,
        strategy,
      } = request.body as {
        identifier: string;
        count: number;
        delay?: number;
        limit?: number;
        windowSeconds?: number;
        strategy?: string;
      };

      const results: Array<{ index: number; allowed: boolean; remaining: number; durationMs: number }> = [];
      let allowed = 0;
      let blocked = 0;

      for (let i = 0; i < count; i++) {
        const start = Date.now();
        const result = await service.checkRateLimit({
          identifier,
          customLimit: limit,
          customWindow: windowSeconds,
          customStrategy: strategy as "token_bucket" | "sliding_window" | "leaky_bucket" | undefined,
        });

        const durationMs = Date.now() - start;
        trackRequest(result.allowed, durationMs);

        if (result.allowed) {
          allowed++;
        } else {
          blocked++;
        }

        results.push({
          index: i,
          allowed: result.allowed,
          remaining: result.remaining,
          durationMs,
        });

        if (delay && i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return reply.code(200).send({
        total: count,
        allowed,
        blocked,
        results: results.slice(0, 100),
      });
    }
  );

  fastify.post(
    "/v1/simulation/attack",
    {
      schema: {
        body: {
          type: "object",
          required: ["targetIdentifier", "requestCount", "burstSize"],
          properties: {
            targetIdentifier: { type: "string" },
            requestCount: { type: "integer", minimum: 100, maximum: 100000 },
            burstSize: { type: "integer", minimum: 1, maximum: 1000 },
            burstInterval: { type: "integer", minimum: 0, maximum: 60000, default: 1000 },
            limit: { type: "integer", minimum: 1 },
            windowSeconds: { type: "integer", minimum: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              targetIdentifier: { type: "string" },
              totalRequests: { type: "integer" },
              blockedRequests: { type: "integer" },
              allowedRequests: { type: "integer" },
              blockRate: { type: "number" },
              durationMs: { type: "integer" },
              analysis: {
                type: "object",
                properties: {
                  attackDetected: { type: "boolean" },
                  peakRequestsPerSecond: { type: "number" },
                  averageRemainingQuota: { type: "number" },
                  strategy: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = new RateLimitService(request.server.redis);
      const {
        targetIdentifier,
        requestCount,
        burstSize,
        burstInterval,
        limit,
        windowSeconds,
      } = request.body as {
        targetIdentifier: string;
        requestCount: number;
        burstSize: number;
        burstInterval?: number;
        limit?: number;
        windowSeconds?: number;
      };

      const startTime = Date.now();
      let blockedRequests = 0;
      let allowedRequests = 0;
      const remainingSamples: number[] = [];
      let peakRps = 0;

      const batches = Math.ceil(requestCount / burstSize);
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now();
        const currentBatchSize = Math.min(burstSize, requestCount - batch * burstSize);
        const batchPromises: Promise<void>[] = [];

        for (let i = 0; i < currentBatchSize; i++) {
          const promise = service.checkRateLimit({
            identifier: targetIdentifier,
            customLimit: limit,
            customWindow: windowSeconds,
          }).then(result => {
            if (result.allowed) {
              allowedRequests++;
            } else {
              blockedRequests++;
            }
            remainingSamples.push(result.remaining);
          });

          batchPromises.push(promise);
        }

        await Promise.all(batchPromises);

        const batchDuration = Date.now() - batchStart;
        const currentRps = currentBatchSize / (batchDuration / 1000);
        if (currentRps > peakRps) {
          peakRps = currentRps;
        }

        if (burstInterval && batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      const durationMs = Date.now() - startTime;
      const avgRemaining = remainingSamples.length > 0
        ? remainingSamples.reduce((a, b) => a + b, 0) / remainingSamples.length
        : 0;
      const blockRate = (blockedRequests / requestCount) * 100;

      const attackDetected = blockRate > 50 && requestCount > (limit || 1000);

      return reply.code(200).send({
        targetIdentifier,
        totalRequests: requestCount,
        blockedRequests,
        allowedRequests,
        blockRate: Math.round(blockRate * 100) / 100,
        durationMs,
        analysis: {
          attackDetected,
          peakRequestsPerSecond: Math.round(peakRps * 100) / 100,
          averageRemainingQuota: Math.round(avgRemaining * 100) / 100,
          strategy: process.env.DEFAULT_STRATEGY || "token_bucket",
        },
      });
    }
  );

  fastify.post(
    "/v1/simulation/reset",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            identifier: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { identifier } = request.body as { identifier?: string };

      if (identifier) {
        await request.server.redis.deleteRateLimit(`ratelimit:${identifier}`);
        return reply.code(200).send({
          success: true,
          message: `Rate limit reset for identifier: ${identifier}`,
        });
      }

      return reply.code(200).send({
        success: true,
        message: "No specific identifier provided for reset",
      });
    }
  );
};

export default simulationRoutes;
