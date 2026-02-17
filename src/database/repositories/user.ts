// src/repositories/UserRepository.ts  (or wherever it lives)
import { eq } from "drizzle-orm"; // ← import eq here (needed for v2 syntax)
import { db } from "../../services/database";
import { users } from "../models"; // assuming ../models exports the users table

export class UserRepository {
  private db: ReturnType<typeof db>;

  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createUser(
    email: string,
    role: "admin" | "moderator" | "user" = "user", // optional + default
  ) {
    const [newUser] = await this.db
      .insert(users)
      .values({ email, role })
      .returning();

    return newUser ?? null; // safety, though returning() should always give array
  }

  /**
   * Finds a user by email (case-sensitive).
   * @returns user object or null if not found
   */
  async getUserByEmail(email: string) {
    return (
      (await this.db.query.users.findFirst({
        where: eq(users.email, email),
        // Optional: columns: { id: true, email: true, role: true, createdAt: true }
      })) ?? null
    );
  }

  async getUserById(id: number) {
    return (
      (await this.db.query.users.findFirst({
        where: eq(users.id, id),
      })) ?? null
    );
  }

  async getUsersByRole(role: "admin" | "moderator" | "user") {
    return await this.db.query.users.findMany({
      where: eq(users.role, role),
      orderBy: [users.createdAt], // or import desc(users.createdAt) for newest first
      limit: 50,
    });
  }
}
