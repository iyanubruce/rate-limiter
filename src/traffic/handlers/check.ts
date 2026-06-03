import Redis from "../../services/redis";
import config from "../../config/env";
import { createJsonResponse, createErrorResponse } from "../utils/response";
import { createHash } from "crypto";
import { findApiKey } from "./db";
import type { BunRequest } from "bun";

const redis = new Redis(config.redis);

interface KeyMetadata {
  userId: number;
  scopes: string[];
  rateLimitOverride?: {
    requestsPerSecond?: number;
    burstSize?: number;
    windowMs?: number;
    strategy?: string;
    endpoints?: Record<
      string,
      { requestsPerSecond: number; burstSize?: number }
    >;
  };
  expiresAt?: string | null;
  revokedAt: null | string;
}

export const createCheckHandler = () => {
  const defaultQuota = config.rateLimit.defaultQuota;
  const defaultWindow = config.rateLimit.defaultWindow;

  return async (req: Request): Promise<Response> => {
    // Standard Bun Request object
    try {
      // 🟢 Fix Bun header retrieval
      const apiKey = req.headers.get("x-api-key");

      if (!apiKey) {
        return createErrorResponse("Missing x-api-key header", 400);
      }

      let quota = defaultQuota;
      let window = defaultWindow;
      let strategy = config.rateLimit.defaultStrategy;
      let keyMetadata: KeyMetadata;

      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const redisKey = `key:${keyHash}`;

      // Try to read metadata cache from Redis
      const keyMetadataStr = await redis.client.get(redisKey);

      if (keyMetadataStr) {
        // 🟢 CACHE HIT
        keyMetadata = JSON.parse(keyMetadataStr);
        // Reset sliding 1-hour expiration safely in background
        redis.client.expire(redisKey, 3600).catch(() => {});
      } else {
        const databaseKey = await findApiKey(keyHash);

        if (!databaseKey) {
          return createErrorResponse("API key not found or revoked", 401);
        }

        // Structure metadata for caching
        keyMetadata = {
          userId: databaseKey.userId,
          scopes: databaseKey.scopes || [],
          rateLimitOverride: databaseKey.rateLimitOverride as any,
          expiresAt: databaseKey.expiresAt
            ? databaseKey.expiresAt.toISOString()
            : null,
          revokedAt: null,
        };

        // Seed Redis so the next client execution is instantaneous
        await redis.client.setex(redisKey, 3600, JSON.stringify(keyMetadata));
      }

      // Extract custom configuration overrides
      if (keyMetadata.rateLimitOverride) {
        quota = keyMetadata.rateLimitOverride.requestsPerSecond || defaultQuota;
        window = keyMetadata.rateLimitOverride.windowMs
          ? keyMetadata.rateLimitOverride.windowMs / 1000
          : defaultWindow;
        strategy = (keyMetadata.rateLimitOverride.strategy as any) || strategy;
      }

      const rateLimitKey = `ratelimit:${keyHash}`;
      const now = Date.now();

      const currentWindow = Math.floor(now / (window * 1000));
      const executionKey = `${rateLimitKey}:${currentWindow}`;

      const result = await redis.checkRateLimit(
        executionKey,
        quota,
        window,
        strategy as any,
      );

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
      console.error("Traffic Handler Error: ", err);
      return createErrorResponse("Internal Server Error", 500);
    }
  };
};
