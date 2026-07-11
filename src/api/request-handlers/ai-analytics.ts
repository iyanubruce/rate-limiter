import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError } from "../../error";
import * as aiAnalyticsController from "../controllers/ai-analytics";

export async function askAnalytics(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = request.user?.tenantId;
  if (!tenantId) {
    throw new ResourceNotFoundError("Tenant not found");
  }

  const { question } = request.body as { question: string };
  const result = await aiAnalyticsController.askAnalytics(tenantId, question);
  return reply.code(200).send(result);
}
