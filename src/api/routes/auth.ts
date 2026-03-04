import type { FastifyPluginAsync } from "fastify";
import * as authHandler from "../request-handlers/auth";
import { registerSchema, loginSchema } from "../validations/auth";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    { schema: registerSchema },
    authHandler.registerHandler,
  );

  fastify.post("/login", { schema: loginSchema }, authHandler.loginHandler);
};
