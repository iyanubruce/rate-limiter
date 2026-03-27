import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  relations,
  type InferSelectModel,
  type InferInsertModel,
} from "drizzle-orm";
import { users } from "./user";

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),

  // 🔐 Security: Store hash, not plaintext
  keyHash: varchar("key_hash", { length: 64 }).notNull(), // SHA256 hex
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(), // e.g., "sk_live_"

  // 👤 Ownership & Multi-tenancy
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tenantId: integer("tenant_id"), // Optional: for org-level isolation

  // 🏷️ Metadata & UX
  name: varchar("name", { length: 100 }).notNull(), // "Production App"
  description: varchar("description", { length: 255 }),

  // 🔑 Permissions & Quotas
  scopes: varchar("scopes").array(), // ["read", "write"]
  rateLimitOverride: jsonb("rate_limit_override"), // { requestsPerSecond: 1000 }

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
});

export type ApiKey = InferSelectModel<typeof apiKeys>;
export type ApiKeyInsert = InferInsertModel<typeof apiKeys>;
export type SafeApiKey = Omit<ApiKey, "keyHash">;
