import Redis from "../../services/redis";
import config from "../../config/env";
import { createJsonResponse, createErrorResponse } from "../utils/response";
import { createHash } from "crypto";
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
  expiresAt?: string;
  revokedAt: null | string;
}

export const createCheckHandler = () => {
  const defaultQuota = config.rateLimit.defaultQuota;
  const defaultWindow = config.rateLimit.defaultWindow;

  return async (req: BunRequest): Promise<Response> => {
    try {
      const apiKey = (req.headers as any).get
        ? (req.headers as any).get("x-api-key")
        : (req.headers as unknown as Record<string, string>)["x-api-key"];

      if (!apiKey) {
        return createErrorResponse("Missing x-api-key header", 400);
      }
      let quota = defaultQuota;
      let window = defaultWindow;
      let strategy = config.rateLimit.defaultStrategy;

      if (apiKey) {
        const keyHash = createHash("sha256").update(apiKey).digest("hex");
        const redisKey = `key:${keyHash}`;
        const keyMetadataStr = await redis.client.get(redisKey);

        if (keyMetadataStr) {
          try {
            const keyMetadata: KeyMetadata = JSON.parse(keyMetadataStr);

            if (keyMetadata.rateLimitOverride) {
              quota =
                keyMetadata.rateLimitOverride.requestsPerSecond || defaultQuota;
              window = keyMetadata.rateLimitOverride.windowMs
                ? keyMetadata.rateLimitOverride.windowMs / 1000
                : defaultWindow;
              strategy =
                (keyMetadata.rateLimitOverride.strategy as any) || strategy;
            }
          } catch (parseError) {
            return createErrorResponse("Invalid API key metadata", 400);
          }
        } else {
          return createErrorResponse("API key not found", 404);
        }
      }

      const key = `ratelimit:${apiKey}`;
      const now = Date.now();

      const currentWindow = Math.floor(now / (window * 1000));
      const redisKey = `${key}:${currentWindow}`;
      console.log(redisKey, quota, window, strategy);
      const result = await redis.checkRateLimit(
        redisKey,
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
      return createErrorResponse("Internal Server Error", 500);
    }
  };
};
