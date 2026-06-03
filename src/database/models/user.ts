// db/schema.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export type userRole = (typeof userRoleEnum.enumValues)[number];
import { apiKeys } from "./api-keys";
import { rateLimitRules } from "./rate-limit-rules";
import {
  relations,
  type InferSelectModel,
  type InferInsertModel,
} from "drizzle-orm";
export const roleEnum = pgEnum("user_role", ["admin", "user"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  google_id: varchar("google_id", { length: 255 }).unique(),
  password: text("password"),
  role: userRoleEnum("role").notNull().default("admin"),
  first_name: varchar("first_name", { length: 255 }).notNull(),
  last_name: varchar("last_name", { length: 255 }).notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  rateLimitRules: many(rateLimitRules),
}));

export type User = InferSelectModel<typeof users>;
export type UserInsert = InferInsertModel<typeof users>;
export type SafeUser = Omit<User, "password">;
