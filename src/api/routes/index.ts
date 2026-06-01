import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import healthRoutes from "./health";
import logger from "../../utils/logger";
import authRoutes from "./auth";
import rateLimitRoutes from "./rate-limit";
import apiKeyRoutes from "./api-keys";
import analyticsRoutes from "./analytics";
import strategiesRoutes from "./strategies";
import alertsRoutes from "./alerts";
import simulationRoutes from "./simulation";
import adminRoutes from "./admin";
import exportRoutes from "./export";
import graphqlRoutes from "./graphql";

export async function registerRoutes(app: FastifyInstance) {
  // Root endpoint
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
  await app.register(rateLimitRoutes, { prefix: "/api" });
  await app.register(apiKeyRoutes, { prefix: "/api-keys" });
  await app.register(analyticsRoutes, { prefix: "/api" });
  await app.register(strategiesRoutes, { prefix: "/api" });
  await app.register(alertsRoutes, { prefix: "/api" });
  await app.register(simulationRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(exportRoutes, { prefix: "/api" });
  await app.register(graphqlRoutes, { prefix: "/api" });
  logger.info("✓ Routes registered");
}
