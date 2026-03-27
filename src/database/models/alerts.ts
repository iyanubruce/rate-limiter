import {
  pgTable,
  serial,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user";

export const alertChannels = pgEnum("alert_channel", [
  "email",
  "webhook",
  "slack",
  "discord",
]);

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  channel: varchar("channel", { length: 50 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  threshold: integer("threshold").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  url: varchar("url", { length: 500 }).notNull(),
  secret: varchar("secret", { length: 255 }),
  events: varchar("events").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  headers: jsonb("headers"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(users, {
    fields: [alerts.userId],
    references: [users.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  user: one(users, {
    fields: [webhooks.userId],
    references: [users.id],
  }),
}));

export type Alert = typeof alerts.$inferSelect;
export type AlertInsert = typeof alerts.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookInsert = typeof webhooks.$inferInsert;
