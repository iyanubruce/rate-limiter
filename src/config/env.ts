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
    defaultStrategy:
      | "token_bucket"
      | "sliding_window"
      | "leaky_bucket"
      | "fixed_window";
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
