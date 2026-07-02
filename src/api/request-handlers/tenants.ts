import * as tenantsController from "../controllers/tenants";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Plan } from "../controllers/tenants";

export const upgradePlan = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const tenantId = request.user?.tenantId;
    const { plan } = request.body as { plan: Plan };
    const result = await tenantsController.upgradePlan(
      tenantId!,
      plan,
    );
    return reply.code(200).send(result);
  } catch (error) {
    throw error;
  }
};
