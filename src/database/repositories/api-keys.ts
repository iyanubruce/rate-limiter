import {
  eq,
  count as countHelper,
  isNull,
  and,
  getTableColumns,
  type SQL,
} from "drizzle-orm";
import { db } from "../../config/database";
import { apiKeys, type ApiKeyInsert, type ApiKey } from "../models/api-keys";
import type { ListKeysWhereClause } from "../../interfaces/api-key";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export type ApiKeyInclude = { user?: true | object; tenant?: true | object };

const apiKeyColumns = getTableColumns(apiKeys);

export default class ApiKeyRepository {
  private db: ReturnType<typeof db>;

  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createApiKey(data: ApiKeyInsert, transaction?: Transaction) {
    const client = transaction || this.db;
    const [newApiKey] = await client.insert(apiKeys).values(data).returning();

    return newApiKey ?? null;
  }

  async findApiKey(options: {
    data: Partial<ApiKey>;
    include?: ApiKeyInclude;
    transaction?: Transaction;
  }) {
    const { data, include, transaction } = options;
    const client = transaction || this.db;
    const conditions: SQL[] = [isNull(apiKeys.revokedAt)];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const column = apiKeyColumns[key as keyof typeof apiKeyColumns];
        if (column) conditions.push(eq(column, value));
      }
    }
    return client.query.apiKeys.findFirst({
      where: and(...conditions),
      ...(include && { with: include }),
    });
  }

  async findApiKeyByKeyHash(options: {
    data: { keyHash: string };
    include?: ApiKeyInclude;
    transaction?: Transaction;
  }) {
    const { data, include, transaction } = options;
    const client = transaction || this.db;
    return client.query.apiKeys.findFirst({
      where: and(eq(apiKeys.keyHash, data.keyHash), isNull(apiKeys.revokedAt)),
      ...(include && { with: include }),
    });
  }
  async listAndCountKeys(
    where: ListKeysWhereClause,
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;

    const [keys, count] = await Promise.all([
      client.query.apiKeys.findMany({
        where: where.query,
        limit: where.limit,
        offset: where.offset,
        orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
      }),
      client
        .select({ value: countHelper() })
        .from(apiKeys)
        .where(where.query)
        .then((res) => res[0]?.value ?? 0),
    ]);

    return { keys, count };
  }

  async getApiKeyByKeyHash(
    keyHash: string,
    transaction?: Transaction,
  ): Promise<ApiKey | null> {
    const client = transaction || this.db;
    const result = await client.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });
    return result ?? null;
  }

  async getValidApiKeyByKeyHash(keyHash: string, transaction?: Transaction) {
    const client = transaction || this.db;
    return await client.query.apiKeys.findFirst({
      where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
    });
  }

  async getApiKeysByUserId(userId: number, transaction?: Transaction) {
    const client = transaction || this.db;
    return await client.query.apiKeys.findMany({
      where: eq(apiKeys.userId, userId),
      orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
    });
  }

  async getValidApiKeyByUserIdAndName(
    userId: number,
    name: string,
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    return (
      (await client.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.name, name),
          isNull(apiKeys.revokedAt),
        ),
      })) ?? null
    );
  }

  async getApiKeyById(
    id: number,
    transaction?: Transaction,
  ): Promise<ApiKey | null> {
    const client = transaction || this.db;
    const result = await client.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    });
    return result ?? null;
  }
  async getApiKeyByIdAndUserId(
    id: number,
    userId: number,
    transaction?: Transaction,
  ): Promise<ApiKey | null> {
    const client = transaction || this.db;
    const result = await client.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)),
    });
    return result ?? null;
  }
  async updateApiKey(
    id: number,
    data: Partial<ApiKeyInsert>,
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    const [updated] = await client
      .update(apiKeys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return updated ?? null;
  }

  async revokeApiKey(id: number, transaction?: Transaction) {
    const client = transaction || this.db;
    const [revoked] = await client
      .update(apiKeys)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();
    return revoked ?? null;
  }

  async deleteApiKeyById(id: number, transaction?: Transaction) {
    const client = transaction || this.db;
    const [deletedApiKey] = await client
      .delete(apiKeys)
      .where(eq(apiKeys.id, id))
      .returning();
    return deletedApiKey ?? null;
  }

  async deleteApiKeyByKeyHash(keyHash: string, transaction?: Transaction) {
    const client = transaction || this.db;
    const [deletedApiKey] = await client
      .delete(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .returning();
    return deletedApiKey ?? null;
  }
}
