import Redis from "../services/redis";
import config from "../config/env";
import { db } from "../config/database";
import { rateLimitEvents } from "../database/models";
import { broadcastQuotaViolation } from "../websocket/native";
import logger from "../utils/logger";
import ApiKeyRepository from "../database/repositories/api-keys";

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
  identifier: string;
  apiKey?: string;
  endpoint?: string;
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  customLimit?: number;
  customWindow?: number;
  customStrategy?: "token_bucket" | "sliding_window" | "leaky_bucket" | "fixed_window";
  userId?: number;
  requestId?: string;
}

export default class RateLimitService {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkRateLimit(params: RateLimitCheckParams): Promise<RateLimitCheckResult> {
    const startTime = Date.now();
    const {
      identifier,
      apiKey,
      endpoint = "/",
      method = "GET",
      ipAddress = "unknown",
      userAgent = "unknown",
      customLimit,
      customWindow,
      customStrategy,
      requestId,
    } = params;

    let limit = customLimit || config.rateLimit.defaultQuota;
    let windowSeconds = customWindow || config.rateLimit.defaultWindow;
    let strategy = customStrategy || config.rateLimit.defaultStrategy;

    let apiKeyId: number | undefined;
    let tenantId: number | undefined;
    let resolvedUserId: number | undefined = params.userId;

    if (apiKey) {
      const keyHash = this.hashApiKey(apiKey);
      const apiKeyRepo = new ApiKeyRepository(db());
      const keyRecord = await apiKeyRepo.getValidApiKeyByKeyHash(keyHash);

      if (keyRecord) {
        apiKeyId = keyRecord.id;
        resolvedUserId = keyRecord.userId;
        tenantId = keyRecord.tenantId || undefined;

        if (keyRecord.rateLimitOverride && typeof keyRecord.rateLimitOverride === 'object') {
          const override = keyRecord.rateLimitOverride as { requestsPerSecond?: number; limit?: number; window?: number };
          if (override.limit) limit = override.limit;
          if (override.window) windowSeconds = override.window;
        }
      }
    }

    const redisKey = `ratelimit:${identifier}:${strategy}`;
    const windowMs = windowSeconds * 1000;

    let result: { allowed: boolean; remaining: number; resetAt: number };
    try {
      result = await this.redis.checkRateLimit(
        redisKey, 
        limit, 
        windowSeconds, 
        strategy as "token_bucket" | "sliding_window" | "leaky_bucket"
      );
    } catch (error) {
      logger.error("Rate limit check failed", { error, identifier });
      result = { allowed: true, remaining: limit - 1, resetAt: Date.now() + windowMs };
    }

    const remainingQuota = result.remaining;
    const usagePercentage = ((limit - remainingQuota) / limit) * 100;

    if (usagePercentage >= config.alerts.quotaWarningThreshold && usagePercentage < 100) {
      this.emitQuotaWarning(identifier, usagePercentage, remainingQuota, limit, tenantId);
    }

    if (!result.allowed) {
      this.logEvent({
        ipAddress,
        endpoint,
        method,
        userAgent,
        statusCode: 429,
        requestDurationMs: Date.now() - startTime,
        userId: resolvedUserId,
        apiKeyId,
        isBlocked: true,
        remainingQuota,
        blockReason: "quota_exceeded",
        requestId,
      });

      broadcastQuotaViolation(tenantId?.toString() || "unknown", {
        identifier,
        remainingQuota,
        limit,
        strategy,
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt: result.resetAt,
        limit,
        strategy,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        blockedReason: "quota_exceeded",
      };
    }

    this.logEvent({
      ipAddress,
      endpoint,
      method,
      userAgent,
      statusCode: 200,
      requestDurationMs: Date.now() - startTime,
      userId: resolvedUserId,
      apiKeyId,
      isBlocked: false,
      remainingQuota,
      requestId,
    });

    return {
      allowed: true,
      remaining: remainingQuota,
      resetAt: result.resetAt,
      limit,
      strategy,
    };
  }

  async checkBatchRateLimits(
    requests: Array<{
      identifier: string;
      limit?: number;
      window?: number;
      strategy?: string;
    }>
  ): Promise<Array<RateLimitCheckResult & { identifier: string }>> {
    const results = await Promise.all(
      requests.map(async (req) => {
        const result = await this.checkRateLimit({
          identifier: req.identifier,
          customLimit: req.limit,
          customWindow: req.window,
          customStrategy: req.strategy as any,
        });
        return { ...result, identifier: req.identifier };
      })
    );
    return results;
  }

  private async logEvent(data: {
    ipAddress: string;
    endpoint: string;
    method: string;
    userAgent: string;
    statusCode: number;
    requestDurationMs: number;
    userId?: number;
    apiKeyId?: number;
    isBlocked: boolean;
    remainingQuota: number;
    blockReason?: string;
    requestId?: string;
  }) {
    try {
      await db().insert(rateLimitEvents).values({
        time: new Date(),
        ipAddress: data.ipAddress,
        endpoint: data.endpoint,
        method: data.method,
        userAgent: data.userAgent,
        statusCode: data.statusCode,
        requestDurationMs: data.requestDurationMs,
        userId: data.userId,
        apiKeyId: data.apiKeyId,
        isBlocked: data.isBlocked,
        remainingQuota: data.remainingQuota,
        blockReason: data.blockReason,
        requestId: data.requestId,
      });
    } catch (error) {
      logger.error("Failed to log rate limit event", { error });
    }
  }

  private emitQuotaWarning(
    identifier: string,
    usagePercentage: number,
    remaining: number,
    limit: number,
    tenantId?: number
  ) {
    const message = {
      type: "quota_warning",
      identifier,
      usagePercentage,
      remaining,
      limit,
      timestamp: Date.now(),
    };

    if (tenantId) {
      broadcastQuotaViolation(tenantId.toString(), message);
    }

    logger.info("Quota warning emitted", message);
  }

  private hashApiKey(apiKey: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }
}
