import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user";

export const rateLimitRules = pgTable("rate_limit_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),

  // Core rate limit config
  name: varchar("name", { length: 255 }).notNull(),
  strategy: varchar("strategy", { length: 50 }).notNull(),
  limit: integer("limit").notNull(),
  windowMs: integer("window_ms").notNull(),

  // Optional advanced features
  endpoint: varchar("endpoint", { length: 500 }),
  ipWhitelist: text("ip_whitelist"),
  isActive: boolean("is_active").default(true),
  burstAllowance: integer("burst_allowance"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rateLimitRulesRelations = relations(rateLimitRules, ({ one }) => ({
  user: one(users, {
    fields: [rateLimitRules.userId],
    references: [users.id],
  }),
}));
