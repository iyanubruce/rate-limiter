export const config = {
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: process.env.HOST || "0.0.0.0",
    env: process.env.NODE_ENV || "development",
    corsOrigins: process.env.CORS_ORIGINS || "*",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
    maxRetries: 3,
    retryDelay: 1000,
  },

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "ratelimitr",
    user: process.env.DB_USER || "iyanuoluwa",
    password: process.env.DB_PASSWORD || "mySecretPassword",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "secret",
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN || "86400"),
  },
  rateLimit: {
    defaultStrategy: process.env.DEFAULT_STRATEGY || "token_bucket",
    defaultQuota: parseInt(process.env.DEFAULT_QUOTA || "1000"),
    defaultWindow: parseInt(process.env.DEFAULT_WINDOW || "60"),
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
    pretty: process.env.NODE_ENV === "development",
  },
};

export default config;
