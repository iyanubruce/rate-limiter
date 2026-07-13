import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import * as aiAnalyticsHandler from "../request-handlers/ai-analytics";
import { aiAnalyticsSchema } from "../validations/ai-analytics";

const aiAnalyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", validateAccessToken);

  fastify.post("/", { schema: aiAnalyticsSchema }, aiAnalyticsHandler.askAnalytics);
};

export default aiAnalyticsRoutes;
