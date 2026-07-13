import type { FastifyPluginAsync } from "fastify";
import * as tenantsHandler from "../request-handlers/tenants";
import { validateAccessToken } from "../middleware/validate-access-token";
import { upgradeTenantSchema } from "../validations/tenants";
const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", validateAccessToken);

  fastify.post(
    "/upgrade",
    { schema: upgradeTenantSchema },
    tenantsHandler.upgradePlan,
  );
};

export default tenantsRoutes;
