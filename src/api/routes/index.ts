import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { healthRoutes } from "./health";
import logger from "../../utils/logger";
import { authRoutes } from "./auth";

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

  logger.info("✓ Routes registered");
}
