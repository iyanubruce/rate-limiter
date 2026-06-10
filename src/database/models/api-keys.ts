import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { users } from "./user";
import { tenants } from "./tenants";
// types/rate-limit.ts
export interface RateLimitOverride {
  requestsPerSecond?: number; // Max sustained RPS
  burstSize?: number; // Token bucket burst capacity
  windowMs?: number; // Custom time window (override default)
  strategy?: "token-bucket" | "sliding-window" | "fixed-window"; // Per-key algorithm
  endpoints?: Record<
    string,
    {
      // Endpoint-specific overrides
      requestsPerSecond: number;
      burstSize?: number;
    }
  >;
  priority?: number; // Rule evaluation order
  expiresAt?: string; // ISO timestamp for temporary overrides
  meta?: Record<string, any>; // Extensible metadata for custom logic
}

export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),

    // 🔐 Security: Store hash, not plaintext
    keyHash: varchar("key_hash", { length: 64 }).notNull(), // SHA256 hex
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(), // e.g., "sk_live_"

    // 👤 Ownership & Multi-tenancy
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    tenantId: varchar("tenant_id", { length: 32 })
      .notNull()
      .references(() => tenants.id)
      .default("org_1"),

    name: varchar("name", { length: 100 }).notNull(), // "Production App"
    description: varchar("description", { length: 255 }),

    // 🔑 Permissions & Quotas
    scopes: varchar("scopes").array(), // ["read", "write"]
    rateLimitOverride: jsonb("rate_limit_override").$type<RateLimitOverride>(), // { requestsPerSecond: 1000 }

    // ⏰ Lifecycle
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"), // Soft-revoke without delete

    // 🌐 Network Controls
    ipAllowlist: varchar("ip_allowlist").array(),

    // 📊 Analytics & Extensibility
    metadata: jsonb("metadata"), // { env: "prod", team: "backend" }

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdNameUniqueIndex: uniqueIndex("user_id_name_unique_idx").on(
        table.userId,
        table.name,
      ),
    };
  },
);

export type ApiKey = InferSelectModel<typeof apiKeys>;
export type ApiKeyInsert = InferInsertModel<typeof apiKeys>;
export type SafeApiKey = Omit<ApiKey, "keyHash">;
