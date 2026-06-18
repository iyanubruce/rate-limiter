import type { FastifyInstance } from "fastify";
import logger from "../../utils/logger";
import healthRoutes from "./health";
import authRoutes from "./auth";
import apiKeyRoutes from "./api-keys";
import analyticsRoutes from "./analytics";
import tenantsRoutes from "./tenants";
import webhookRoutes from "./webhooks";

export async function registerRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      schema: {
        description: "API information",
        tags: ["info"],
        response: {
          200: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              status: { type: "string" },
              timestamp: { type: "string" },
              docs: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return {
        name: "RateLimitr",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
        docs: `${request.protocol}://${request.hostname}/docs`,
      };
    },
  );

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(apiKeyRoutes, { prefix: "/api-keys" });
  await app.register(analyticsRoutes, { prefix: "/analytics" });
  await app.register(tenantsRoutes, { prefix: "/tenants" });
  await app.register(webhookRoutes, { prefix: "/webhooks" });
  logger.info("✓ Routes registered");
}
