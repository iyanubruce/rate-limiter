import type { FastifyPluginAsync } from "fastify";
import * as healthHandler from "../request-handlers/health";
import { metrics } from "../../services/metrics";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", healthHandler.healthHandler);
  
  fastify.get("/detailed", healthHandler.detailedHealthHandler);
  
  fastify.get("/metrics", async (request, reply) => {
    const content = metrics.toPrometheusFormat();
    return reply
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(content);
  });
};

export default healthRoutes;
