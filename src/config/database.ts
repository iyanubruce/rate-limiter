import pg from "pg";
import logger from "../utils/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import type { QueryResult, QueryResultRow } from "pg"; // make sure to import this
import * as schema from "../database/models";
import config from "./env";
const { Pool } = pg;

export type DatabaseConfig = typeof config.database;

export interface Tenant {
  id: string;
  name: string;
  email: string;
  api_key: string;
  plan: "free" | "pro" | "enterprise";
  quota: number;
  strategy: "token_bucket" | "sliding_window" | "leaky_bucket";
  window_seconds: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RateLimitLog {
  id: string;
  tenant_id: string;
  identifier: string;
  resource?: string;
  allowed: boolean;
  strategy: string;
  quota_remaining: number;
  timestamp: Date;
}

export class DatabaseClient {
  private pool: pg.Pool;
  private config: DatabaseConfig;
  private isConnected: boolean = false;
  public readonly db: ReturnType<typeof drizzle<typeof schema>>;
  constructor(config: DatabaseConfig) {
    this.config = config;

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.max,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
    });
    this.db = drizzle(this.pool, { schema });
    this.setupEventHandlers();
  }

  public getDb() {
    return this.db;
  }
  private setupEventHandlers() {
    this.pool.on("connect", () => {
      logger.debug("New database connection established");
    });

    this.pool.on("error", (error: any) => {
      logger.error("Unexpected database error:", error);
    });

    this.pool.on("remove", () => {
      logger.debug("Database connection removed from pool");
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();

      this.isConnected = true;
      logger.info("✓ PostgreSQL connected successfully");

      // Initialize database schema
    } catch (error: Error | any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Database connection error: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info("✓ PostgreSQL disconnected successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Database connection error: ${errorMessage}`);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.pool.query("SELECT 1");
      return result.rowCount === 1;
    } catch (error) {
      return false;
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: any[],
  ): Promise<pg.QueryResult<T>> {
    return await this.pool.query<T>(text, params);
  }
  // Transaction support
  async transaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

// Singleton helpers
let _instance: DatabaseClient | undefined;

export function initDb(config: DatabaseConfig) {
  _instance ??= new DatabaseClient(config);
  return _instance;
}

export function getDbClient() {
  if (!_instance) throw new Error("Call initDb() first");
  return _instance;
}

export const db = () => {
  initDb(config.database);
  return getDbClient().getDb();
};
