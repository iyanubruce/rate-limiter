import Redis from "../services/redis";
import config from "../config/env";
import { trafficDb } from "../config/traffic-database";
import { ratelimitEventQueue } from "../jobs/queues/queue";
import { createHash } from "crypto";
import logger from "../utils/logger";
import ApiKeyRepo from "../database/repositories/api-keys";
import type { KeyMetadata } from "../traffic/handlers/checkRateLimit/types";

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  strategy: string;
  retryAfter?: number;
  blockedReason?: string;
}

export interface RateLimitCheckParams {
  tenantId: string;
  identifier: string;
  apiKey: string;
  endpoint?: string;
  method?: string;
  weight?: number;
  ipAddress?: string;
  userAgent?: string;
  userId?: number;
  requestId?: string;
}

export default class RateLimitService {
  private redis: Redis;
  private apiKeyRepo: ApiKeyRepo;

  constructor() {
    this.redis = new Redis(config.redis);
    this.apiKeyRepo = new ApiKeyRepo(trafficDb);
  }

  async checkRateLimit(params: RateLimitCheckParams): Promise<RateLimitCheckResult> {
    const startTime = Date.now();
    const {
      tenantId,
      identifier,
      apiKey,
      endpoint,
      method,
      weight = 1,
      ipAddress = identifier,
      userAgent = "UNKNOWN",
    } = params;

    let quota = config.rateLimit.defaultQuota;
    let window = config.rateLimit.defaultWindow;
    let strategy: string = config.rateLimit.defaultStrategy;
    let keyMetadata: KeyMetadata;
    let apiKeyId: number;

    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const redisKey = `key:${keyHash}`;

    const keyMetadataStr = await this.redis.client.get(redisKey);

    if (keyMetadataStr) {
      keyMetadata = JSON.parse(keyMetadataStr);

      if (keyMetadata.tenantId !== tenantId) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: Date.now(),
          limit: quota,
          strategy: strategy as string,
          blockedReason: "api_key_mismatch",
        };
      }

      this.redis.client.expire(redisKey, 3600).catch(() => {});
    } else {
      const databaseKey = await this.apiKeyRepo.findApiKeyByKeyHash(keyHash);

      if (!databaseKey || databaseKey.tenantId !== tenantId) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: Date.now(),
          limit: quota,
          strategy: strategy as string,
          blockedReason: "api_key_not_found_or_revoked",
        };
      }

      keyMetadata = {
        id: databaseKey.id,
        userId: databaseKey.userId,
        tenantId: databaseKey.tenantId,
        scopes: databaseKey.scopes || [],
        rateLimitOverride: databaseKey.rateLimitOverride as any,
        expiresAt: databaseKey.expiresAt
          ? databaseKey.expiresAt.toISOString()
          : null,
        revokedAt: null,
      };

      await this.redis.client.setex(redisKey, 3600, JSON.stringify(keyMetadata));
    }

    apiKeyId = keyMetadata.id;

    if (keyMetadata.rateLimitOverride) {
      quota = keyMetadata.rateLimitOverride.requestsPerSecond || config.rateLimit.defaultQuota;
      window = keyMetadata.rateLimitOverride.windowMs
        ? keyMetadata.rateLimitOverride.windowMs / 1000
        : config.rateLimit.defaultWindow;
      strategy = keyMetadata.rateLimitOverride.strategy || strategy;
    }

    const routePath = endpoint && method ? `:${method}:${endpoint}` : "";
    const rateLimitKey = `ratelimit:${tenantId}:${identifier}${routePath}`;
    const now = Date.now();

    let executionKey = rateLimitKey;
    if (strategy === "fixed_window") {
      const currentWindow = Math.floor(now / (window * 1000));
      executionKey = `${rateLimitKey}:${currentWindow}`;
    }

    let result: { allowed: boolean; remaining: number; resetAt: number };
    try {
      result = await this.redis.checkRateLimit(
        executionKey,
        quota,
        window,
        strategy as "token_bucket" | "sliding_window" | "leaky_bucket" | "fixed_window",
        weight,
      );
    } catch (error) {
      logger.error("Rate limit check failed", { error, identifier });
      result = { allowed: true, remaining: quota - 1, resetAt: Date.now() + window * 1000 };
    }

    const remainingQuota = result.remaining;

    ratelimitEventQueue.add("log-event", {
      time: new Date(),
      tenantId,
      apiKeyId,
      ipAddress,
      endpoint: endpoint || "/",
      method: method || "GET",
      userAgent,
      statusCode: result.allowed ? 200 : 429,
      requestDurationMs: Date.now() - startTime,
      responseSize: 0,
      isBlocked: !result.allowed,
      remainingQuota,
    });

    if (!result.allowed) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: result.resetAt,
        limit: quota,
        strategy: strategy as string,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        blockedReason: "quota_exceeded",
      };
    }

    return {
      allowed: true,
      remaining: remainingQuota,
      resetAt: result.resetAt,
      limit: quota,
      strategy: strategy as string,
    };
  }

  async checkBatchRateLimits(
    requests: Array<{
      tenantId: string;
      identifier: string;
      apiKey: string;
      endpoint?: string;
      method?: string;
      weight?: number;
    }>
  ): Promise<Array<RateLimitCheckResult & { identifier: string }>> {
    const results = await Promise.all(
      requests.map(async (req) => {
        const result = await this.checkRateLimit({
          tenantId: req.tenantId,
          identifier: req.identifier,
          apiKey: req.apiKey,
          endpoint: req.endpoint,
          method: req.method,
          weight: req.weight,
        });
        return { ...result, identifier: req.identifier };
      })
    );
    return results;
  }
}
