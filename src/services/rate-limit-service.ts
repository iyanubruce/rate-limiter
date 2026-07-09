import Redis, { getSharedRedis } from "../services/redis";
import config from "../config/env";
import { trafficDb } from "../config/traffic-database";
import { ratelimitEventQueue } from "../jobs/queues/queue";
import { createHash } from "crypto";
import logger from "../utils/logger";
import ApiKeyRepo from "../database/repositories/api-keys";
import { alertCheckQueue } from "../jobs/queues/alert-check-queue";
import type { ApiKey } from "../database/models/api-keys";
import type { Tenant } from "../database/models/tenants";
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
    this.redis = getSharedRedis();
    this.apiKeyRepo = new ApiKeyRepo(trafficDb);
  }

  async checkRateLimit(
    params: RateLimitCheckParams,
  ): Promise<RateLimitCheckResult> {
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

    const keyHash = this.getKeyHash(apiKey);

    const keyMetadata = await this.resolveKeyMetadata(keyHash, tenantId);
    if (!keyMetadata) {
      return this.buildBlockedResponse(
        config.rateLimit.defaultQuota,
        config.rateLimit.defaultStrategy,
        "api_key_mismatch",
      );
    }

    const { quota, window, strategy } = this.resolveRateLimitConfig(keyMetadata);

    const executionKey = this.buildRateLimitExecutionKey(
      tenantId, identifier, strategy, window, endpoint, method,
    );

    const result = await this.executeRateCheck(
      executionKey, quota, window, strategy, weight, identifier,
    );

    this.fireAnalyticsEvent({
      startTime,
      tenantId,
      apiKeyId: keyMetadata.id,
      ipAddress,
      endpoint,
      method,
      userAgent,
      allowed: result.allowed,
      remainingQuota: result.remaining,
    });

    if (!result.allowed) {
      return this.buildBlockedResponse(quota, strategy, "quota_exceeded", result.resetAt);
    }

    this.fireAlertCheck(tenantId, keyMetadata.userId, result.remaining, quota);

    return this.buildAllowedResponse(result.remaining, result.resetAt, quota, strategy);
  }

  async checkBatchRateLimits(
    requests: Array<Pick<RateLimitCheckParams, "tenantId" | "identifier" | "apiKey" | "endpoint" | "method" | "weight">>,
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
      }),
    );
    return results;
  }

  private getKeyHash(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  private async resolveKeyMetadata(
    keyHash: string,
    tenantId: string,
  ): Promise<KeyMetadata | null> {
    const redisKey = `key:${keyHash}`;
    const cached = await this.redis.client.get(redisKey);

    if (cached) {
      const meta: KeyMetadata = JSON.parse(cached);
      if (meta.tenantId !== tenantId) return null;
      this.redis.client.expire(redisKey, 3600).catch(() => {});
      return meta;
    }

    const databaseKey = (await this.apiKeyRepo.findApiKeyByKeyHash({
      data: { keyHash },
      include: {
        tenant: {
          columns: {
            plan: true,
            quota: true,
            strategy: true,
            windowSeconds: true,
          },
        },
      },
    })) as ApiKey & {
      tenant?: Pick<Tenant, "plan" | "quota" | "strategy" | "windowSeconds">;
    };

    if (!databaseKey || databaseKey.tenantId !== tenantId) return null;

    const meta: KeyMetadata = {
      id: databaseKey.id,
      userId: databaseKey.userId,
      tenantId: databaseKey.tenantId,
      scopes: databaseKey.scopes || [],
      plan: databaseKey.tenant?.plan ?? "free",
      strategy: databaseKey.tenant?.strategy ?? config.rateLimit.defaultStrategy,
      quota: databaseKey.tenant?.quota ?? config.rateLimit.defaultQuota,
      window: databaseKey.tenant?.windowSeconds ?? config.rateLimit.defaultWindow,
      rateLimitOverride: databaseKey.rateLimitOverride ?? undefined,
      expiresAt: databaseKey.expiresAt ? databaseKey.expiresAt.toISOString() : null,
      revokedAt: null,
    };

    await this.redis.client.setex(redisKey, 3600, JSON.stringify(meta));
    return meta;
  }

  private resolveRateLimitConfig(
    keyMetadata: KeyMetadata,
  ): { quota: number; window: number; strategy: string } {
    const defaults = {
      quota: config.rateLimit.defaultQuota,
      window: config.rateLimit.defaultWindow,
      strategy: config.rateLimit.defaultStrategy as string,
    };

    let { quota, window, strategy } = defaults;

    if (keyMetadata.plan && keyMetadata.quota && keyMetadata.window) {
      quota = keyMetadata.quota;
      window = keyMetadata.window;
      strategy = keyMetadata.strategy || defaults.strategy;
    }

    if (keyMetadata.rateLimitOverride) {
      quota = keyMetadata.rateLimitOverride.requestsPerSecond || defaults.quota;
      window = keyMetadata.rateLimitOverride.windowMs
        ? keyMetadata.rateLimitOverride.windowMs / 1000
        : defaults.window;
      strategy = keyMetadata.rateLimitOverride.strategy || strategy;
    }

    return { quota, window, strategy };
  }

  private buildRateLimitExecutionKey(
    tenantId: string,
    identifier: string,
    strategy: string,
    window: number,
    endpoint?: string,
    method?: string,
  ): string {
    const routePath = endpoint && method ? `:${method}:${endpoint}` : "";
    const key = `ratelimit:${tenantId}:${identifier}${routePath}`;

    if (strategy === "fixed_window") {
      const currentWindow = Math.floor(Date.now() / (window * 1000));
      return `${key}:${currentWindow}`;
    }

    return key;
  }

  private async executeRateCheck(
    executionKey: string,
    quota: number,
    window: number,
    strategy: string,
    weight: number,
    identifier: string,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    try {
      return await this.redis.checkRateLimit(
        executionKey,
        quota,
        window,
        strategy as "token_bucket" | "sliding_window" | "leaky_bucket" | "fixed_window",
        weight,
      );
    } catch (error) {
      logger.error("Rate limit check failed", { error, identifier });
      return {
        allowed: true,
        remaining: quota - 1,
        resetAt: Date.now() + window * 1000,
      };
    }
  }

  private fireAnalyticsEvent(params: {
    startTime: number;
    tenantId: string;
    apiKeyId: number;
    ipAddress: string;
    endpoint?: string;
    method?: string;
    userAgent: string;
    allowed: boolean;
    remainingQuota: number;
  }): void {
    const { startTime, tenantId, apiKeyId, ipAddress, endpoint, method, userAgent, allowed, remainingQuota } = params;

    ratelimitEventQueue.add("log-event", {
      time: new Date(),
      tenantId,
      apiKeyId,
      ipAddress,
      endpoint: endpoint || "/",
      method: method || "GET",
      userAgent,
      statusCode: allowed ? 200 : 429,
      requestDurationMs: Date.now() - startTime,
      responseSize: 0,
      isBlocked: !allowed,
      remainingQuota,
    }).catch(() => {});
  }

  private fireAlertCheck(
    tenantId: string,
    userId: number,
    remaining: number,
    quota: number,
  ): void {
    alertCheckQueue.add("check", { tenantId, userId, remaining, quota }).catch(() => {});
  }

  private buildAllowedResponse(
    remaining: number,
    resetAt: number,
    limit: number,
    strategy: string,
  ): RateLimitCheckResult {
    return { allowed: true, remaining, resetAt, limit, strategy };
  }

  private buildBlockedResponse(
    limit: number,
    strategy: string,
    blockedReason: string,
    resetAt?: number,
  ): RateLimitCheckResult {
    return {
      allowed: false,
      remaining: 0,
      resetAt: resetAt ?? Date.now(),
      limit,
      strategy,
      ...(blockedReason === "quota_exceeded" ? { retryAfter: Math.ceil(((resetAt ?? Date.now()) - Date.now()) / 1000) } : {}),
      blockedReason,
    };
  }
}
