import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { users, type UserInsert, type User } from "../models/user";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export default class UserRepository {
  private db: ReturnType<typeof db>;
  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createUser(
    data: Omit<UserInsert, "googleId">,
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    try {
      const [newUser] = await client.insert(users).values(data).returning();
      return newUser ?? null;
    } catch (err: any) {
      // Postgres unique violation code = 23505 (duplicate email)
      if (err?.code === "23505") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Finds a user by email (case-sensitive).
   * @returns user object or null if not found
   */
  async getUserByEmail(email: string, transaction?: Transaction) {
    const client = transaction || this.db;
    return (
      (await client.query.users.findFirst({
        where: eq(users.email, email),
        // Optional: columns: { id: true, email: true, role: true, createdAt: true }
      })) ?? null
    );
  }

  async getUserById(id: number, transaction?: Transaction) {
    const client = transaction || this.db;
    return (
      (await client.query.users.findFirst({
        where: eq(users.id, id),
      })) ?? null
    );
  }

  async getUsersByRole(role: "admin" | "user", transaction?: Transaction) {
    const client = transaction || this.db;
    return await client.query.users.findMany({
      where: eq(users.role, role),
      orderBy: [users.created_at], // or import desc(users.createdAt) for newest first
      limit: 50,
    });
  }

  async findById(id: number, transaction?: Transaction) {
    const client = transaction || this.db;
    return (
      (await client.query.users.findFirst({
        where: eq(users.id, id),
      })) ?? null
    );
  }
}
