import type { FastifyPluginAsync } from "fastify";
import * as healthHandler from "../request-handlers/health"

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", healthHandler.healthHandler);
};

