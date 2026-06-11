import { sql, eq, and, count as countHelper, desc } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { db } from "../../config/database";
import {
  rateLimitEvents,
  type RateLimitEvent,
  type RateLimitInsert,
} from "../models/rate-limit-events";

type QueryOp<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
};
export type RateLimitEventWhereInput = {
  [K in keyof RateLimitEvent]?: RateLimitEvent[K] | QueryOp<RateLimitEvent[K]>;
};
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
  ): Promise<RateLimitEvent | null> {
    const client = transaction || db();

    const [newRateLimitEvent] = await client
      .insert(rateLimitEvents)
      .values(data)
      .returning();

    return newRateLimitEvent ?? null;
  }

  async countRateLimitEvent(
    where: RateLimitEventWhereInput,
    transaction?: Transaction,
  ): Promise<number> {
    const client = transaction || db();
    const conditions = this.buildConditions(where);

    const [result] = await client
      .select({ count: countHelper() })
      .from(rateLimitEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result?.count ?? 0);
  }

  async findRateLimitEvents(
    where: RateLimitEventWhereInput,
    opts?: {
      limit?: number;
      offset?: number;
      orderByDesc?: boolean;
    },
    transaction?: Transaction,
  ): Promise<RateLimitEvent[]> {
    const client = transaction || db();
    const conditions = this.buildConditions(where);

    const query = client
      .select()
      .from(rateLimitEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(opts?.orderByDesc !== false ? desc(rateLimitEvents.time) : rateLimitEvents.time);

    if (opts?.limit) query.limit(opts.limit);
    if (opts?.offset) query.offset(opts.offset);

    return query;
  }

  async aggregateRateLimitEvents<T>(
    select: Record<string, unknown>,
    where: RateLimitEventWhereInput,
    opts?: {
      groupBy?: SQL[];
      orderBy?: SQL;
      limit?: number;
    },
    transaction?: Transaction,
  ): Promise<T[]> {
    const client = transaction || db();
    const conditions = this.buildConditions(where);

    const query = client
      .select(select as any)
      .from(rateLimitEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    if (opts?.groupBy) {
      query.groupBy(...opts.groupBy);
    }

    if (opts?.orderBy) {
      query.orderBy(opts.orderBy);
    }

    if (opts?.limit) {
      query.limit(opts.limit);
    }

    return query as unknown as Promise<T[]>;
  }

  private buildConditions(where: RateLimitEventWhereInput): SQL[] {
    const conditions: SQL[] = [];

    for (const [key, raw] of Object.entries(where)) {
      const column = rateLimitEvents[key as keyof typeof rateLimitEvents] as SQLWrapper | undefined;
      if (!column || raw === undefined || raw === null) continue;

      if (typeof raw === "object" && !(raw instanceof Date)) {
        const op = raw as QueryOp<unknown>;
        if (op.$eq !== undefined) conditions.push(eq(column, op.$eq as any));
        if (op.$ne !== undefined) conditions.push(sql`${column} <> ${op.$ne as any}`);
        if (op.$gt !== undefined) conditions.push(sql`${column} > ${op.$gt as any}`);
        if (op.$gte !== undefined) conditions.push(sql`${column} >= ${op.$gte as any}`);
        if (op.$lt !== undefined) conditions.push(sql`${column} < ${op.$lt as any}`);
        if (op.$lte !== undefined) conditions.push(sql`${column} <= ${op.$lte as any}`);
      } else {
        conditions.push(eq(column, raw as any));
      }
    }

    return conditions;
  }
}
