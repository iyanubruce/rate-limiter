import { defineConfig } from "drizzle-kit";
import config from "./src/config/env";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/models/index.ts",
  out: "./src/database/migrations",
  dbCredentials: {
    user: config.database.user,
    password: config.database.password,
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    ssl: false,
  },
});
