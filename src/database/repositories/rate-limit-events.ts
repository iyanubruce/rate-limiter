import { eq, count as countHelper, isNull, and } from "drizzle-orm";
import { db } from "../../config/database";
import {
  rateLimitEvents,
  type RateLimitEvents,
  type RateLimitInsert,
} from "../models/rate-limit-events";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export default class RateLimitRepository {
  private db: ReturnType<typeof db>;

  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createRateLimitEvent(
    data: RateLimitInsert,
    transaction?: Transaction,
  ): Promise<RateLimitEvents | null> {
    const client = transaction || db();

    const [newRateLimitEvent] = await client
      .insert(rateLimitEvents)
      .values(data)
      .returning();

    return newRateLimitEvent ?? null;
  }
}
