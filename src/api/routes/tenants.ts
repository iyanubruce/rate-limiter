import type { FastifyPluginAsync } from "fastify";
import * as tenantsHandler from "../request-handlers/tenants";
import { validateAccessToken } from "../middleware/validate-access-token";

const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/upgrade",
    {
      preHandler: [validateAccessToken],
      schema: {
        body: {
          type: "object",
          required: ["plan"],
          properties: {
            plan: {
              type: "string",
              enum: ["pro", "enterprise"],
            },
          },
        },
      },
    },
    tenantsHandler.upgradePlan,
  );
};

export default tenantsRoutes;
