import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import { apiKeys } from "../../database/models/api-keys";
import { createHash } from "crypto";
import Redis from "../../services/redis";
import RateLimitRuleRepository from "../../database/repositories/rate-limit-rules";
import config from "../../config/env";

const redis = new Redis(config.redis);
const ruleRepository = new RateLimitRuleRepository(db());

export async function checkRateLimit(identifier: string) {
  const result = await redis.checkRateLimit(
    `ratelimit:${identifier}`,
    config.rateLimit.defaultQuota,
    config.rateLimit.defaultWindow,
    config.rateLimit.defaultStrategy as any,
  );

  return {
    ...result,
    limit: config.rateLimit.defaultQuota,
    strategy: config.rateLimit.defaultStrategy,
  };
}

export async function createRule(userId: number, data: {
  name: string;
  strategy: string;
  limit: number;
  windowMs: number;
  endpoint?: string;
  ipWhitelist?: string;
  isActive?: boolean;
  burstAllowance?: number;
}) {
  return await ruleRepository.createRule({
    userId,
    ...data,
  });
}

export async function listRules(userId: number, options: {
  limit: number;
  page: number;
  status?: string;
}) {
  const { limit, page } = options;
  const offset = (page - 1) * limit;

  const { rules, count } = await ruleRepository.listAndCountRules(userId, {
    limit,
    offset,
    page,
  });

  const totalPages = Math.ceil(count / limit);
  const hasMore = page < totalPages;

  return {
    rules,
    pagination: {
      total: count,
      limit,
      page,
      hasMore,
      totalPages,
    },
  };
}

export async function updateRule(ruleId: number, userId: number, data: Partial<{
  name: string;
  strategy: string;
  limit: number;
  windowMs: number;
  endpoint: string;
  ipWhitelist: string;
  isActive: boolean;
  burstAllowance: number;
}>) {
  const existing = await ruleRepository.getRuleById(ruleId);
  if (!existing) {
    return null;
  }

  if (existing.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return await ruleRepository.updateRule(ruleId, data);
}

export async function deleteRule(ruleId: number, userId: number) {
  const existing = await ruleRepository.getRuleById(ruleId);
  if (!existing) {
    return null;
  }

  if (existing.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return await ruleRepository.deleteRule(ruleId);
}

export async function getQuotaStatus(key: string, strategy: string) {
  const result = await redis.getQuotaStatus(key, strategy);
  return {
    key,
    remaining: result.remaining,
    total: result.total,
    strategy,
  };
}

export async function validateApiKey(apiKey: string) {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const keyRecord = await db().query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
    columns: { id: true, userId: true, tenantId: true, scopes: true },
  });
  return keyRecord;
}

export async function getRuleById(ruleId: number, userId: number) {
  const rule = await ruleRepository.getRuleById(ruleId);
  if (!rule || rule.userId !== userId) {
    return null;
  }
  return rule;
}

export async function getQuotaForApiKey(apiKeyId: number, userId?: number) {
  const key = await db().query.apiKeys.findFirst({
    where: eq(apiKeys.id, apiKeyId),
  });

  if (!key || (userId && key.userId !== userId)) {
    throw new Error("API key not found");
  }

  const result = await redis.getQuotaStatus(`apikey:${apiKeyId}`, "token_bucket");
  const override = (key.rateLimitOverride || {}) as { requestsPerSecond?: number };

  return {
    apiKeyId,
    name: key.name,
    remaining: result.remaining,
    total: result.total,
    limit: override.requestsPerSecond || config.rateLimit.defaultQuota,
    strategy: "token_bucket",
    createdAt: key.createdAt,
  };
}

export async function updateQuotaForApiKey(apiKeyId: number, userId: number, data: {
  limit?: number;
  windowSeconds?: number;
  strategy?: string;
}) {
  const key = await db().query.apiKeys.findFirst({
    where: eq(apiKeys.id, apiKeyId),
  });

  if (!key || key.userId !== userId) {
    throw new Error("API key not found or unauthorized");
  }

  const existingOverride = (key.rateLimitOverride || {}) as { requestsPerSecond?: number; windowSeconds?: number };
  const rateLimitOverride = {
    requestsPerSecond: data.limit || existingOverride.requestsPerSecond || config.rateLimit.defaultQuota,
    windowSeconds: data.windowSeconds || existingOverride.windowSeconds || config.rateLimit.defaultWindow,
  };

  await db().update(apiKeys)
    .set({ rateLimitOverride, updatedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyId));

  return {
    apiKeyId,
    rateLimitOverride,
    message: "Quota updated successfully",
  };
}

export async function swapRuleStrategy(ruleId: number, userId: number, strategy: string) {
  const rule = await ruleRepository.getRuleById(ruleId);
  if (!rule || rule.userId !== userId) {
    throw new Error("Rule not found or unauthorized");
  }

  const previousStrategy = rule.strategy;
  await ruleRepository.updateRule(ruleId, { strategy });

  return {
    success: true,
    previousStrategy,
    newStrategy: strategy,
    ruleId,
    message: `Strategy hot-swapped from ${previousStrategy} to ${strategy}`,
  };
}
