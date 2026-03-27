import { eq, count as countHelper, and, type SQL } from "drizzle-orm";
import { db } from "../../config/database";
import { rateLimitRules } from "../models/rate-limit-rules";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export default class RateLimitRuleRepository {
  private db: ReturnType<typeof db>;

  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createRule(
    data: {
      userId: number;
      name: string;
      strategy: string;
      limit: number;
      windowMs: number;
      endpoint?: string;
      ipWhitelist?: string;
      isActive?: boolean;
      burstAllowance?: number;
    },
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    const [rule] = await client
      .insert(rateLimitRules)
      .values(data)
      .returning();
    return rule ?? null;
  }

  async getRuleById(id: number, transaction?: Transaction) {
    const client = transaction || this.db;
    return (
      (await client.query.rateLimitRules.findFirst({
        where: eq(rateLimitRules.id, id),
      })) ?? null
    );
  }

  async getRulesByUserId(userId: number, transaction?: Transaction) {
    const client = transaction || this.db;
    return await client.query.rateLimitRules.findMany({
      where: eq(rateLimitRules.userId, userId),
      orderBy: (rules, { desc }) => [desc(rules.createdAt)],
    });
  }

  async updateRule(
    id: number,
    data: Partial<{
      name: string;
      strategy: string;
      limit: number;
      windowMs: number;
      endpoint: string;
      ipWhitelist: string;
      isActive: boolean;
      burstAllowance: number;
    }>,
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    const [updated] = await client
      .update(rateLimitRules)
      .set(data)
      .where(eq(rateLimitRules.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteRule(id: number, transaction?: Transaction) {
    const client = transaction || this.db;
    const [deleted] = await client
      .delete(rateLimitRules)
      .where(eq(rateLimitRules.id, id))
      .returning();
    return deleted ?? null;
  }

  async listAndCountRules(
    userId: number,
    options: { limit: number; offset: number; page: number },
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    const { limit, offset } = options;

    const [rules, countResult] = await Promise.all([
      client.query.rateLimitRules.findMany({
        where: eq(rateLimitRules.userId, userId),
        limit,
        offset,
        orderBy: (rules, { desc }) => [desc(rules.createdAt)],
      }),
      client
        .select({ value: countHelper() })
        .from(rateLimitRules)
        .where(eq(rateLimitRules.userId, userId))
        .then((res) => res[0]?.value ?? 0),
    ]);

    return { rules, count: countResult };
  }
}
