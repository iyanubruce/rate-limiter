import type { FastifyPluginAsync } from "fastify";
import * as authHandler from "../request-handlers/auth";
import { registerSchema, loginSchema, refreshTokenSchema } from "../validations/auth";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    { schema: registerSchema },
    authHandler.registerHandler,
  );

  fastify.post("/login", { schema: loginSchema }, authHandler.loginHandler);

  fastify.post("/refresh", { schema: refreshTokenSchema }, authHandler.refreshHandler);
};

export default authRoutes;
