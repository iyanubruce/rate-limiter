import logger from "../utils/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../database/models";
import { sql } from "drizzle-orm";

export async function setupTimescaleDB(
  db: ReturnType<typeof drizzle<typeof schema>>,
) {
  // 1. Ensure extension exists
  try {
    await db.execute(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);
    await db.execute(sql`
    SELECT create_hypertable(
      'rate_limit_events',
      'time',
      if_not_exists => TRUE,
      migrate_data => TRUE
    );
  `);
    await db.execute(`
    ALTER TABLE rate_limit_events SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'user_id, api_key_id',
      timescaledb.compress_orderby = 'time DESC'
    );
  `);

    await db.execute(`
    SELECT add_compression_policy(
      'rate_limit_events',
      INTERVAL '7 days',
      if_not_exists => TRUE
    );
  `);

    await db.execute(`
    SELECT add_retention_policy(
      'rate_limit_events',
      INTERVAL '90 days',
      if_not_exists => TRUE
    );
  `);

    logger.info("✓ TimescaleDB setup completed");
  } catch (e) {
    logger.error("Failed to setup TimescaleDB");
    throw e;
  }
}
