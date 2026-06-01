import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user";
import { apiKeys } from "./api-keys";
import { rateLimitRules } from "./rate-limit-rules";

export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: serial("id").notNull(),
    time: timestamp("time", { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(), // TimescaleDB will partition on this

    // Request metadata
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    method: varchar("method", { length: 15 }).notNull().default("GET"),
    userAgent: varchar("user_agent", { length: 500 }), // NEW

    // Response data
    statusCode: integer("status_code").notNull(),
    requestDurationMs: integer("request_duration_ms"),
    responseSize: integer("response_size"), // NEW - bytes

    // Rate limiting specifics
    userId: integer("user_id").references(() => users.id),
    apiKeyId: integer("api_key_id").references(() => apiKeys.id),
    ruleId: integer("rule_id").references(() => rateLimitRules.id),
    isBlocked: boolean("is_blocked").notNull().default(false),
    remainingQuota: integer("remaining_quota"), // NEW - requests left
    blockReason: varchar("block_reason", { length: 255 }), // NEW - "quota_exceeded", "suspicious_pattern"

    // Advanced tracking
    requestId: varchar("request_id", { length: 100 }), // NEW - for tracing
    country: varchar("country", { length: 2 }), // NEW - ISO country code
    deviceFingerprint: varchar("device_fingerprint", { length: 64 }), // NEW
  },
  (table) => ({
    pk: primaryKey({
      name: "rate_limit_events_time_id_pk",
      columns: [table.time, table.id],
    }),
  }),
);
export const rateLimitEventsRelations = relations(
  rateLimitEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [rateLimitEvents.userId],
      references: [users.id],
    }),
    apiKey: one(apiKeys, {
      fields: [rateLimitEvents.apiKeyId],
      references: [apiKeys.id],
    }),
    rule: one(rateLimitRules, {
      fields: [rateLimitEvents.ruleId],
      references: [rateLimitRules.id],
    }),
  }),
);
