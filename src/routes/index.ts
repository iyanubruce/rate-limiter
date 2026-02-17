import type { FastifyInstance, FastifyPluginOptions } from "fastify";
// import { healthRoutes } from './health';
// import { metricsRoutes } from './metrics';
// import { apiV1Routes } from './api/v1';
import logger from "../utils/logger";

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

  //   // Health check routes
  //   await app.register(healthRoutes, { prefix: '/health' });

  //   // Metrics routes
  //   await app.register(metricsRoutes, { prefix: '/metrics' });

  //   // API v1 routes
  //   await app.register(apiV1Routes, { prefix: '/api/v1' });

  logger.info("✓ Routes registered");
}
