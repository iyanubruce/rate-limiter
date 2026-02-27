import { defineConfig } from "drizzle-kit";
import config from "./src/config/env";
export default defineConfig({
  dialect: "postgresql", // or "mysql" | "sqlite"
  schema: "./src/database/models",
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
