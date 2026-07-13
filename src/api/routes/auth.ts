import type { FastifyPluginAsync } from "fastify";
import * as authHandler from "../request-handlers/auth";
import { minutes } from "../../helpers/rate-limit";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../validations/auth";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    {
      schema: registerSchema,
      config: { rateLimit: { max: 5, timeWindow: minutes(1) } },
    },
    authHandler.registerHandler,
  );

  fastify.post(
    "/login",
    {
      schema: loginSchema,
      config: { rateLimit: { max: 5, timeWindow: minutes(1) } },
    },
    authHandler.loginHandler,
  );

  fastify.post(
    "/refresh",
    { schema: refreshTokenSchema },
    authHandler.refreshHandler,
  );
};

export default authRoutes;
