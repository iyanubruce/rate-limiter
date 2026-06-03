import { parseWhereQueryForListApiKeys } from "../../helpers/api-key";
import type {
  ListKeysInterface,
  CreateKeyInput,
} from "../../interfaces/api-key";
import ApiKeyRepo from "../../database/repositories/api-keys";
import { db } from "../../config/database";
import { createHash, randomBytes } from "crypto";
import { BadRequestError, InternalServerError } from "../../error";
import Redis from "../../services/redis";
import config from "../../config/env";

const apiKeyRepository = new ApiKeyRepo(db());
const redis = new Redis(config.redis);

export async function listKeys(data: ListKeysInterface, userId: number) {
  const queryOptions = parseWhereQueryForListApiKeys(data, userId);
  console.log(data.page);
  const { keys, count } = await apiKeyRepository.listAndCountKeys(queryOptions);

  const safeKeys = keys.map((key) => {
    const { keyHash, ...safeKey } = key;
    return safeKey;
  });

  const totalPages = Math.ceil(count / queryOptions.limit);
  const hasMore = queryOptions.page < totalPages;

  return {
    keys: safeKeys,
    pagination: {
      total: count,
      limit: data.limit,
      page: data.page ?? 1,
      hasMore,
      nextPage: hasMore ? queryOptions.page + 1 : null,
      totalPages,
    },
  };
}

export async function createKey(data: CreateKeyInput, userId: number) {
  const {
    name,
    description,
    tenantId,
    keyPrefix,
    scopes = ["read"],
    rateLimitOverride,
    expiresAt,
    metadata,
    ipAllowlist,
  } = data;

  const keySuffix = randomBytes(24).toString("base64url"); // 32 chars
  const apiKey = `${keyPrefix ?? "sk_live_"}${keySuffix}`;
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const existing = await apiKeyRepository.getValidApiKeyByUserIdAndName(
    userId,
    name,
  );

  if (existing) {
    throw new BadRequestError("API key with this name already exists");
  }

  const newKey = await db().transaction(async (transaction) => {
    const inserted = await apiKeyRepository.createApiKey(
      {
        name,
        keyHash,
        keyPrefix: data.keyPrefix ?? "sk_live_",
        userId,
        ...(description && { description }),
        ...(scopes && { scopes }),
        ...(rateLimitOverride && { rateLimitOverride }),
        ...(ipAllowlist && { ipAllowlist }),
        ...(metadata && { metadata }),
        ...(tenantId && { tenantId }),
      },
      transaction,
    );
    await redis.client.setex(
      `key:${keyHash}`,
      3600, // 1 hour TTL (refreshed on use)
      JSON.stringify({
        userId,
        scopes,
        rateLimitOverride,
        expiresAt,
        revokedAt: null,
      }),
    );

    return inserted;
  });
  if (!newKey) {
    throw new InternalServerError("Failed to create API key");
  }

  return {
    apiKey,
    keyId: newKey.id,
    name: newKey.name,
    description: newKey.description,
    scopes: newKey.scopes,
    rateLimitOverride: newKey.rateLimitOverride,
    expiresAt: newKey.expiresAt,
    createdAt: newKey.createdAt,
    isActive: true,
  };
}

export async function updateKey(
  keyId: number,
  userId: number,
  data: {
    name?: string;
    description?: string;
    scopes?: string[];
    rateLimitOverride?: {
      requestsPerSecond?: number;
      burstSize?: number;
    } | null;
  },
) {
  const existing = await apiKeyRepository.getApiKeyById(keyId);
  if (!existing) throw new BadRequestError("API key not found");

  if (existing.userId !== userId)
    throw new BadRequestError("Not authorized to update this key");

  if (data.name) {
    const duplicateKey = await apiKeyRepository.findApiKey(userId, data.name);
    if (duplicateKey)
      throw new BadRequestError("A key with this name already exists");
  }
  const updated = await apiKeyRepository.updateApiKey(keyId, data);
  return updated;
}

export async function deleteKey(keyId: number, userId: number) {
  const existing = await apiKeyRepository.getApiKeyById(keyId);
  if (!existing) throw new BadRequestError("API key not found");

  if (existing.userId !== userId)
    throw new BadRequestError("Not authorized to delete this key");
  if (existing.revokedAt) throw new BadRequestError("Key already deleted");
  const revoked = await db().transaction(async (transaction) => {
    const revokedKey = await apiKeyRepository.revokeApiKey(keyId);
    await redis.client.del(`key:${existing.keyHash}`);
    return revokedKey;
  });
  return revoked;
}

export async function getKeyById(keyId: number, userId: number) {
  const key = await apiKeyRepository.getApiKeyByIdAndUserId(keyId, userId);
  if (!key) {
    throw new BadRequestError("API key not found");
  }
  const { keyHash, ...safeKey } = key;
  return safeKey;
}
