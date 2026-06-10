import {
  pgTable,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user";
import { generateTenantId } from "../../utils/generate-tenant-id.ts"; // Your Nanoid script

export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 32 })
    .primaryKey()
    .$defaultFn(() => generateTenantId()),

  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),

  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  quota: integer("quota").notNull().default(1000),
  strategy: varchar("strategy", { length: 50 })
    .notNull()
    .default("fixed_window"),
  windowSeconds: integer("window_seconds").notNull().default(60),

  isActive: boolean("is_active").notNull().default(true),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
}));

export type Tenant = typeof tenants.$inferSelect;
export type TenantInsert = typeof tenants.$inferInsert;
