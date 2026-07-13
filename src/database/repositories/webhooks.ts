import { eq, and } from "drizzle-orm";
import { db } from "../../config/database";
import { webhooks, type Webhook, type WebhookInsert } from "../models/alerts";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export default class WebhookRepository {
  private db: ReturnType<typeof db>;

  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async create(
    data: WebhookInsert,
    transaction?: Transaction,
  ): Promise<Webhook> {
    const client = transaction || db();
    const [webhook] = await client.insert(webhooks).values(data).returning();
    return webhook!;
  }

  async findById(
    id: number,
    transaction?: Transaction,
  ): Promise<Webhook | undefined> {
    const client = transaction || db();
    const [webhook] = await client
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id));
    return webhook;
  }

  async findAllByUserId(
    userId: number,
    transaction?: Transaction,
  ): Promise<Webhook[]> {
    const client = transaction || db();
    return client
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, userId));
  }

  async update(
    id: number,
    data: Partial<WebhookInsert>,
    transaction?: Transaction,
  ): Promise<Webhook | undefined> {
    const client = transaction || db();
    const [webhook] = await client
      .update(webhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return webhook;
  }

  async delete(
    id: number,
    transaction?: Transaction,
  ): Promise<Webhook | undefined> {
    const client = transaction || db();
    const [webhook] = await client
      .delete(webhooks)
      .where(eq(webhooks.id, id))
      .returning();
    return webhook;
  }

  async findActiveByUserId(
    userId: number,
    transaction?: Transaction,
  ): Promise<Webhook[]> {
    const client = transaction || db();
    return client
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)));
  }

  async findActiveByUserIds(
    userIds: number[],
    transaction?: Transaction,
  ): Promise<Webhook[]> {
    if (userIds.length === 0) return [];
    const client = transaction || db();
    const conditions = userIds.map((id) => eq(webhooks.userId, id));
    return client
      .select()
      .from(webhooks)
      .where(and(...conditions, eq(webhooks.isActive, true)));
  }
}
