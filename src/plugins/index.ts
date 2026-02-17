import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import compress from "@fastify/compress";
import config from "../config/env";
import logger from "../utils/logger";

export async function registerPlugins(app: FastifyInstance) {
  // Compression
  await app.register(compress, {
    global: true,
    threshold: 1024, // Only compress responses > 1KB
  });

  // CORS
  await app.register(cors, {
    origin:
      config.server.env === "development" ? "*" : config.server.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: config.server.env === "production",
    crossOriginEmbedderPolicy: false,
  });

  // Rate limiting (meta!)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis: app.redis.client,
    nameSpace: "fastify-rate-limit:",
    skipOnError: true,
  });

  // Swagger documentation
  await app.register(swagger, {
    swagger: {
      info: {
        title: "RateLimitr API",
        description:
          "Production-grade distributed rate limiting service with real-time analytics and multi-tenant support",
        version: "1.0.0",
      },
      host: `${config.server.host}:${config.server.port}`,
      schemes: ["http", "https"],
      consumes: ["application/json"],
      produces: ["application/json"],
      tags: [
        { name: "health", description: "Health check endpoints" },
        { name: "rate-limit", description: "Rate limiting operations" },
        { name: "analytics", description: "Analytics and reporting" },
        { name: "tenants", description: "Tenant management" },
      ],
      securityDefinitions: {
        apiKey: {
          type: "apiKey",
          name: "X-API-Key",
          in: "header",
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });

  logger.info("✓ Plugins registered");
}
