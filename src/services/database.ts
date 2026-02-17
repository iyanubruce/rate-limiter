import pg from "pg";
import logger from "../utils/logger";
import type { QueryResult, QueryResultRow } from "pg"; // make sure to import this
const { Pool } = pg;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // connection pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

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

  constructor(config: DatabaseConfig) {
    this.config = {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...config,
    };

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

    this.setupEventHandlers();
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
      await this.initializeSchema();
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

  private async initializeSchema(): Promise<void> {
    try {
      // Create tenants table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          api_key VARCHAR(255) UNIQUE NOT NULL,
          plan VARCHAR(50) DEFAULT 'free',
          quota INTEGER DEFAULT 1000,
          strategy VARCHAR(50) DEFAULT 'token_bucket',
          window_seconds INTEGER DEFAULT 60,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create rate_limit_logs table (for analytics)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS rate_limit_logs (
          id BIGSERIAL PRIMARY KEY,
          tenant_id VARCHAR(255) NOT NULL,
          identifier VARCHAR(255) NOT NULL,
          resource VARCHAR(255),
          allowed BOOLEAN NOT NULL,
          strategy VARCHAR(50) NOT NULL,
          quota_remaining INTEGER,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        );
      `);

      // Create index for faster queries
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_tenant_timestamp 
        ON rate_limit_logs(tenant_id, timestamp DESC);
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_timestamp 
        ON rate_limit_logs(timestamp DESC);
      `);

      // Create API keys index
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_tenants_api_key 
        ON tenants(api_key);
      `);

      logger.info("✓ Database schema initialized");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Database initialization error: ${errorMessage}`);
      throw error;
    }
  }

  // Tenant operations
  async createTenant(data: {
    name: string;
    email: string;
    plan?: "free" | "pro" | "enterprise";
  }): Promise<Tenant> {
    const id = `tenant_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const apiKey = `ratelimitr_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const plan = data.plan || "free";
    const quota = plan === "free" ? 1000 : plan === "pro" ? 10000 : 100000;

    const result = await this.pool.query<Tenant>(
      `INSERT INTO tenants (id, name, email, api_key, plan, quota)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.name, data.email, apiKey, plan, quota],
    );

    if (result.rowCount === 0 || !result.rows[0]) {
      throw new Error("Failed to create tenant");
    }

    return result.rows[0];
  }

  async getTenantByApiKey(apiKey: string): Promise<Tenant | null> {
    const result = await this.pool.query<Tenant>(
      "SELECT * FROM tenants WHERE api_key = $1 AND is_active = true",
      [apiKey],
    );

    return result.rows[0] || null;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const result = await this.pool.query<Tenant>(
      "SELECT * FROM tenants WHERE id = $1",
      [id],
    );

    return result.rows[0] || null;
  }

  async updateTenant(
    id: string,
    data: Partial<Omit<Tenant, "id" | "created_at">>,
  ): Promise<Tenant | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== "id" && key !== "created_at") {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.getTenantById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await this.pool.query<Tenant>(
      `UPDATE tenants SET ${fields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values,
    );

    return result.rows[0] || null;
  }

  async deleteTenant(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM tenants WHERE id = $1", [
      id,
    ]);

    return (result.rowCount || 0) > 0;
  }

  async listTenants(
    limit: number = 100,
    offset: number = 0,
  ): Promise<Tenant[]> {
    const result = await this.pool.query<Tenant>(
      "SELECT * FROM tenants ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    );

    return result.rows;
  }

  // Rate limit logging
  async logRateLimit(data: {
    tenantId: string;
    identifier: string;
    resource?: string;
    allowed: boolean;
    strategy: string;
    quotaRemaining: number;
  }): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO rate_limit_logs 
         (tenant_id, identifier, resource, allowed, strategy, quota_remaining)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          data.tenantId,
          data.identifier,
          data.resource || null,
          data.allowed,
          data.strategy,
          data.quotaRemaining,
        ],
      );
    } catch (error) {
      // Don't throw - logging failures shouldn't break rate limiting
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Database connection error: ${errorMessage}`);
      throw error;
    }
  }

  // Analytics queries
  async getAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRequests: number;
    allowedRequests: number;
    blockedRequests: number;
    blockRate: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
         COUNT(*) as total_requests,
         SUM(CASE WHEN allowed = true THEN 1 ELSE 0 END) as allowed_requests,
         SUM(CASE WHEN allowed = false THEN 1 ELSE 0 END) as blocked_requests
       FROM rate_limit_logs
       WHERE tenant_id = $1 
         AND timestamp >= $2 
         AND timestamp <= $3`,
      [tenantId, startDate, endDate],
    );

    const row = result.rows[0];
    const totalRequests = parseInt(row.total_requests) || 0;
    const allowedRequests = parseInt(row.allowed_requests) || 0;
    const blockedRequests = parseInt(row.blocked_requests) || 0;
    const blockRate =
      totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;

    return {
      totalRequests,
      allowedRequests,
      blockedRequests,
      blockRate: parseFloat(blockRate.toFixed(2)),
    };
  }

  async getTimeSeriesAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    granularity: "hour" | "day" | "week" = "day",
  ): Promise<
    Array<{
      timestamp: Date;
      allowed: number;
      blocked: number;
    }>
  > {
    const truncFormat =
      granularity === "hour" ? "hour" : granularity === "day" ? "day" : "week";

    const result = await this.pool.query(
      `SELECT 
         DATE_TRUNC($4, timestamp) as timestamp,
         SUM(CASE WHEN allowed = true THEN 1 ELSE 0 END) as allowed,
         SUM(CASE WHEN allowed = false THEN 1 ELSE 0 END) as blocked
       FROM rate_limit_logs
       WHERE tenant_id = $1 
         AND timestamp >= $2 
         AND timestamp <= $3
       GROUP BY DATE_TRUNC($4, timestamp)
       ORDER BY timestamp ASC`,
      [tenantId, startDate, endDate, truncFormat],
    );

    return result.rows.map((row) => ({
      timestamp: row.timestamp,
      allowed: parseInt(row.allowed),
      blocked: parseInt(row.blocked),
    }));
  }

  // Get database statistics
  async getStats(): Promise<{
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    tenantCount: number;
    logCount: number;
  }> {
    try {
      const tenantResult = await this.pool.query(
        "SELECT COUNT(*) FROM tenants",
      );
      const logResult = await this.pool.query(
        "SELECT COUNT(*) FROM rate_limit_logs",
      );

      return {
        connected: this.isConnected,
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingConnections: this.pool.waitingCount,
        tenantCount: parseInt(tenantResult.rows[0].count),
        logCount: parseInt(logResult.rows[0].count),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Database connection error: ${errorMessage}`);
      return {
        connected: this.isConnected,
        totalConnections: 0,
        idleConnections: 0,
        waitingConnections: 0,
        tenantCount: 0,
        logCount: 0,
      };
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
