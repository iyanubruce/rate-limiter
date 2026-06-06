import Redis from "../../../services/redis";
import config from "../../../config/env";
import { createJsonResponse, createErrorResponse } from "../../utils/response";
import { createHash } from "crypto";
import logger from "../../../utils/logger";
import type { KeyMetadata, CheckRateLimitInput } from "./types";
import { trafficDb } from "../../../config/traffic-database";
import ApiKeyRepo from "../../../database/repositories/api-keys";
import { ratelimitEventQueue } from "../../../jobs/queues/queue";
const redis = new Redis(config.redis);
const apiKeyRepo = new ApiKeyRepo(trafficDb);

const defaultQuota = config.rateLimit.defaultQuota;
const defaultWindow = config.rateLimit.defaultWindow;

export const createCheckHandler = () => {
  return async (req: any): Promise<Response> => {
    try {
      const apiKey = req.headers.get("x-api-key")!;
      const data: CheckRateLimitInput = req.body;
      const { tenantId, identifier, endpoint, method, weight } = data;

      let quota = defaultQuota;
      let window = defaultWindow;
      let strategy = config.rateLimit.defaultStrategy;
      let keyMetadata: KeyMetadata;

      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const redisKey = `key:${keyHash}`;

      const keyMetadataStr = await redis.client.get(redisKey);

      if (keyMetadataStr) {
        keyMetadata = JSON.parse(keyMetadataStr);
        redis.client.expire(redisKey, 3600).catch(() => {});
      } else {
        const databaseKey = await apiKeyRepo.findApiKeyByKeyHash(keyHash);

        if (!databaseKey) {
          return createErrorResponse("API key not found or revoked", 401);
        }

        keyMetadata = {
          id: databaseKey.id,
          userId: databaseKey.userId,
          scopes: databaseKey.scopes || [],
          rateLimitOverride: databaseKey.rateLimitOverride as any,
          expiresAt: databaseKey.expiresAt
            ? databaseKey.expiresAt.toISOString()
            : null,
          revokedAt: null,
        };

        await redis.client.setex(redisKey, 3600, JSON.stringify(keyMetadata));
      }

      if (keyMetadata.rateLimitOverride) {
        quota = keyMetadata.rateLimitOverride.requestsPerSecond || defaultQuota;
        window = keyMetadata.rateLimitOverride.windowMs
          ? keyMetadata.rateLimitOverride.windowMs / 1000
          : defaultWindow;
        strategy = (keyMetadata.rateLimitOverride.strategy as any) || strategy;
      }

      const routePath = endpoint && method ? `:${method}:${endpoint}` : "";
      const rateLimitKey = `ratelimit:${tenantId}:${identifier}${routePath}`;
      const now = Date.now();

      let executionKey = rateLimitKey;
      if (strategy === "fixed_window") {
        const currentWindow = Math.floor(now / (window * 1000));
        executionKey = `${rateLimitKey}:${currentWindow}`;
      }

      const result = await redis.checkRateLimit(
        executionKey,
        quota,
        window,
        strategy,
        weight,
      );

      ratelimitEventQueue.add("log-event", {
        time: new Date(),
        tenantId,
        apiKeyId: keyMetadata.id,
        ipAddress: identifier,
        endpoint: endpoint || "/",
        method: method || "GET",
        userAgent: req.headers.get("user-agent") || "UNKNOWN",
        statusCode: result.allowed ? 200 : 429,
        requestDurationMs: Date.now() - now,
        responseSize: 0,
        isBlocked: !result.allowed,
        remainingQuota: result.remaining,
      });
      const responsePayload = {
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt: result.resetAt,
        limit: quota,
        strategy,
      };

      return createJsonResponse(responsePayload, result.allowed ? 200 : 429, {
        "X-RateLimit-Limit": String(quota),
        "X-RateLimit-Remaining": String(result.remaining),
      });
    } catch (err) {
      logger.error("Traffic Handler Error: ", err);
      return createErrorResponse("Internal Server Error", 500);
    }
  };
};
