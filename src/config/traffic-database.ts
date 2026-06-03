import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import config from "./env";
import * as schema from "../database/models";

const { Pool } = pg;

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  max: 3,
});

export const trafficDb = drizzle(pool, { schema });
