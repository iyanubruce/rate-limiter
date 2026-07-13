import { eq, and, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "../../config/database";
import { alerts, type Alert, type AlertInsert } from "../models/alerts";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export default class AlertRepository {
  private db: ReturnType<typeof db>;

  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async create(
    data: AlertInsert,
    transaction?: Transaction,
  ): Promise<Alert | null> {
    const client = transaction || db();
    const [created] = await client.insert(alerts).values(data).returning();
    return created ?? null;
  }

  async findActiveByTenantAndType(
    tenantId: string,
    type: Alert["type"],
    transaction?: Transaction,
  ): Promise<Alert[]> {
    const client = transaction || db();
    return client
      .select()
      .from(alerts)
      .where(
        and(eq(alerts.tenantId, tenantId), eq(alerts.type, type), eq(alerts.isActive, true)),
      )
      .orderBy(desc(alerts.createdAt));
  }
}
