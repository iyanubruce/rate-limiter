import {
  pgTable,
  varchar,
  timestamp,
  integer,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import {
  type InferSelectModel,
  type InferInsertModel,
  relations,
} from "drizzle-orm";
import { apiKeys } from "./api-keys";

export const rateLimitEvents = pgTable("rate_limit_events", {
  time: timestamp("time", { precision: 6, withTimezone: true })
    .notNull()
    .defaultNow(),
  tenantId: varchar("tenant_id", { length: 255 }).notNull(),
  apiKeyId: integer("api_key_id")
    .references(() => apiKeys.id)
    .notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull().default("GET"),
  userAgent: text("user_agent"),
  statusCode: integer("status_code").notNull(),
  requestDurationMs: integer("request_duration_ms"),
  responseSize: integer("response_size"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  remainingQuota: integer("remaining_quota"),
});

export const rateLimitEventsRelations = relations(
  rateLimitEvents,
  ({ one }) => ({
    apiKey: one(apiKeys, {
      fields: [rateLimitEvents.apiKeyId],
      references: [apiKeys.id],
    }),
  }),
);

export type RateLimitEvents = InferSelectModel<typeof rateLimitEvents>;
export type RateLimitInsert = InferInsertModel<typeof rateLimitEvents>;
