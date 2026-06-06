import logger from "../utils/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../database/models";
import { sql } from "drizzle-orm";

export async function setupTimescaleDB(
  db: ReturnType<typeof drizzle<typeof schema>>,
) {
  try {
    logger.info("Initializing TimescaleDB features...");

    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

    await db.execute(sql`
      SELECT create_hypertable(
        'rate_limit_events',
        'time',
        if_not_exists => TRUE,
        migrate_data => TRUE
      );
    `);

    await db.execute(sql`
      ALTER TABLE rate_limit_events SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'tenant_id, api_key_id',
        timescaledb.compress_orderby = 'time DESC'
      );
    `);

    await db.execute(sql`
      SELECT add_compression_policy(
        'rate_limit_events',
        INTERVAL '7 days',
        if_not_exists => TRUE
      );
    `);

    await db.execute(sql`
      SELECT add_retention_policy(
        'rate_limit_events',
        INTERVAL '90 days',
        if_not_exists => TRUE
      );
    `);

    logger.info(
      "✓ TimescaleDB setup completed successfully with multi-tenant segmenting",
    );
  } catch (e: any) {
    logger.error(`❌ Failed to setup TimescaleDB: ${e.message}`);
    throw e;
  }
}
