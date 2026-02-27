// src/repositories/UserRepository.ts  (or wherever it lives)
import { eq } from "drizzle-orm"; // ← import eq here (needed for v2 syntax)
import { db } from "../../config/database";
import { users } from "../models"; // assuming ../models exports the users table
import { roleEnum } from "../models/user"; // import the enum type if needed

export class UserRepository {
  private db: ReturnType<typeof db>;
  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: (typeof roleEnum.enumValues)[number] = "admin",
  ) {
    try {
      const [newUser] = await this.db
        .insert(users)
        .values({
          email,
          role,
          password,
          first_name: firstName,
          last_name: lastName,
        })
        .returning();

      return newUser ?? null;
    } catch (err: any) {
      // Postgres unique violation code = 23505 (duplicate email)
      if (err?.code === "23505") {
        return null;
      }
      throw err;
    }
  }

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    first_name: string,
    last_name: string,
    role: (typeof roleEnum.enumValues)[number] = "admin",
  ) {
    const user = await this.getUserByEmail(email);
    if (user) {
      return user;
    }
    return this.createUser(email, googleId, first_name, last_name, role);
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
      orderBy: [users.created_at], // or import desc(users.createdAt) for newest first
      limit: 50,
    });
  }
}
