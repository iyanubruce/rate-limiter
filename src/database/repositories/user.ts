// src/repositories/UserRepository.ts  (or wherever it lives)
import { eq } from "drizzle-orm"; // ← import eq here (needed for v2 syntax)
import { db } from "../../config/database";
import { users } from "../models"; // assuming ../models exports the users table
import { roleEnum } from "../models/user"; // import the enum type if needed

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

export default class UserRepository {
  private db: ReturnType<typeof db>;
  constructor(dbInstance: ReturnType<typeof db>) {
    this.db = dbInstance;
  }

  async createUser(
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: (typeof roleEnum.enumValues)[number];
    },
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    try {
      const [newUser] = await client
        .insert(users)
        .values({
          email: data.email,
          role: data.role || "admin",
          password: data.password,
          first_name: data.firstName,
          last_name: data.lastName,
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
    data: {
      googleId: string;
      email: string;
      firstName: string;
      lastName: string;
      role?: (typeof roleEnum.enumValues)[number];
    },
    transaction?: Transaction,
  ) {
    const client = transaction || this.db;
    const user = await this.getUserByEmail(data.email, transaction);
    if (user) {
      return user;
    }

    const [newUser] = await client
      .insert(users)
      .values({
        email: data.email,
        role: data.role || "admin",
        first_name: data.firstName,
        last_name: data.lastName,
        password: "", // password is required in schema, setting empty or random for OAuth users
      })
      .returning();

    return newUser ?? null;
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
