import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

const StringBooleanSchema = z
  .union([
    z.literal("true"),
    z.literal("false"),
    z.literal("1"),
    z.literal("0"),
  ])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const envPath = path.resolve(
  process.cwd(),
  process.env.NODE_ENV === "test" ? ".env.test" : ".env",
);

expand(dotenvConfig({ override: true, path: envPath }));

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "staging", "test"])
    .default("development"),
  CORS_ORIGINS: z.string().default("*"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("ratelimitr"),
  DB_USER: z.string().default("iyanuoluwa"),
  DB_PASSWORD: z.string().default("mySecretPassword"),
  DB_MAX: z.coerce.number().default(20),
  DB_IDLE_TIMEOUT_MILLIS: z.coerce.number().default(30000),
  DB_CONNECTION_TIMEOUT_MILLIS: z.coerce.number().default(2000),
  JWT_SECRET: z.string().default("secret"),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  DEFAULT_STRATEGY: z
    .enum(["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"])
    .default("token_bucket"),
  DEFAULT_QUOTA: z.coerce.number().default(1000),
  DEFAULT_WINDOW: z.coerce.number().default(60),
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(60000),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_PRO: z.string().default("pro"),
  STRIPE_PRICE_ENTERPRISE: z.string().default("price_1TrOvTGWoI7tKhosS1car72v"),
  STRIPE_SUCCESS_URL: z.string().default("https://example.com/success"),
  STRIPE_CANCEL_URL: z.string().default("https://example.com/cancel"),
  QUOTA_WARNING_THRESHOLD: z.coerce.number().default(80),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PRETTY_LOGS: StringBooleanSchema,
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const env = result.data;

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
  stripe: {
    secretKey: string;
    webhookSecret: string;
    priceIds: {
      pro: string;
      enterprise: string;
    };
    successUrl: string;
    cancelUrl: string;
  };
  alerts: {
    quotaWarningThreshold: number;
  };
  ai: {
    apiKey: string;
    model: string;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
}

const config: Config = {
  server: {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
    corsOrigins: env.CORS_ORIGINS,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    maxRetries: 3,
    retryDelay: 1000,
  },
  database: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    max: env.DB_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MILLIS,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  rateLimit: {
    defaultStrategy: env.DEFAULT_STRATEGY,
    defaultQuota: env.DEFAULT_QUOTA,
    defaultWindow: env.DEFAULT_WINDOW,
  },
  circuitBreaker: {
    threshold: env.CIRCUIT_BREAKER_THRESHOLD,
    timeout: env.CIRCUIT_BREAKER_TIMEOUT,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceIds: {
      pro: env.STRIPE_PRICE_PRO,
      enterprise: env.STRIPE_PRICE_ENTERPRISE,
    },
    successUrl: env.STRIPE_SUCCESS_URL,
    cancelUrl: env.STRIPE_CANCEL_URL,
  },
  alerts: {
    quotaWarningThreshold: env.QUOTA_WARNING_THRESHOLD,
  },
  ai: {
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
  },
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.PRETTY_LOGS,
  },
};

export default config;
