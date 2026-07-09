import type { FastifyPluginAsync } from "fastify";
import * as healthHandler from "../request-handlers/health";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", healthHandler.healthHandler);
  
  fastify.get("/detailed", healthHandler.detailedHealthHandler);
};

export default healthRoutes;
