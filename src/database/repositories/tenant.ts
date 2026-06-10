import {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  count as countHelper,
  isNull,
  and,
  SQL,
} from "drizzle-orm";
import { db } from "../../config/database";
import { tenants, type TenantInsert, type Tenant } from "../models/tenants";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

type QueryOp<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
};

// 2. Allow each Tenant property to be a raw value OR a QueryOp object
export type TenantWhereInput = {
  [K in keyof Tenant]?: Tenant[K] | QueryOp<Tenant[K]>;
};

export default class ApiKeyRepository {
  private db: ReturnType<typeof db>;
  constructor(dbClient: ReturnType<typeof db>) {
    this.db = dbClient;
  }

  async createTenant(data: TenantInsert, transaction?: Transaction) {
    const client = transaction || db();

    const [newRateLimitEvent] = await client
      .insert(tenants)
      .values(data)
      .returning();

    return newRateLimitEvent ?? null;
  }

  async getTenantByEmail(email: string, transaction?: Transaction) {
    const client = transaction || this.db;
    return (
      (await client.query.tenants.findFirst({
        where: eq(tenants.email, email),
      })) ?? null
    );
  }

  async getTenant(
    data: TenantWhereInput,
    transaction?: Transaction,
  ): Promise<Tenant | null> {
    const client = transaction || this.db;
    const conditions: SQL[] = [];

    function applyOperator<T>(
      array: SQL[],
      column: any,
      value: T | QueryOp<T>,
    ) {
      if (
        value &&
        typeof value === "object" &&
        !value.constructor.name.includes("Date")
      ) {
        const op = value as QueryOp<T>;
        if (op.$eq !== undefined) array.push(eq(column, op.$eq));
        if (op.$ne !== undefined) array.push(ne(column, op.$ne));
        if (op.$gt !== undefined) array.push(gt(column, op.$gt));
        if (op.$gte !== undefined) array.push(gte(column, op.$gte));
        if (op.$lt !== undefined) array.push(lt(column, op.$lt));
        if (op.$lte !== undefined) array.push(lte(column, op.$lte));
      } else {
        array.push(eq(column, value));
      }
    }

    if (data.id !== undefined) applyOperator(conditions, tenants.id, data.id);
    if (data.email !== undefined)
      applyOperator(conditions, tenants.email, data.email);
    if (data.name !== undefined)
      applyOperator(conditions, tenants.name, data.name);
    if (data.plan !== undefined)
      applyOperator(conditions, tenants.plan, data.plan);
    if (data.quota !== undefined)
      applyOperator(conditions, tenants.quota, data.quota);
    if (data.strategy !== undefined)
      applyOperator(conditions, tenants.strategy, data.strategy);
    if (data.windowSeconds !== undefined)
      applyOperator(conditions, tenants.windowSeconds, data.windowSeconds);
    if (data.isActive !== undefined)
      applyOperator(conditions, tenants.isActive, data.isActive);
    if (data.createdAt !== undefined)
      applyOperator(conditions, tenants.createdAt, data.createdAt);
    if (data.updatedAt !== undefined)
      applyOperator(conditions, tenants.updatedAt, data.updatedAt);

    if (conditions.length === 0) return null;

    return (
      (await client.query.tenants.findFirst({
        where: and(...conditions),
      })) ?? null
    );
  }
}
