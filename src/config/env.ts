export interface Config {
  server: {
    port: number;
    host: string;
    env: string;
    corsOrigins: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetries: number;
    retryDelay: number;
  };
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  jwt: {
    secret: string;
    expiresIn: number;
    refreshExpiresIn: number;
  };
  rateLimit: {
    defaultStrategy: "token_bucket" | "sliding_window" | "leaky_bucket" | "fixed_window";
    defaultQuota: number;
    defaultWindow: number;
  };
  circuitBreaker: {
    threshold: number;
    timeout: number;
  };
  alerts: {
    quotaWarningThreshold: number;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: process.env.HOST || "0.0.0.0",
    env: process.env.NODE_ENV || "development",
    corsOrigins: process.env.CORS_ORIGINS || "*",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
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
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "604800"),
  },
  rateLimit: {
    defaultStrategy: (process.env.DEFAULT_STRATEGY as Config["rateLimit"]["defaultStrategy"]) || "token_bucket",
    defaultQuota: parseInt(process.env.DEFAULT_QUOTA || "1000"),
    defaultWindow: parseInt(process.env.DEFAULT_WINDOW || "60"),
  },
  circuitBreaker: {
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "5"),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || "60000"),
  },
  alerts: {
    quotaWarningThreshold: parseInt(process.env.QUOTA_WARNING_THRESHOLD || "80"),
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    pretty: process.env.NODE_ENV === "development",
  },
};

export default config;
