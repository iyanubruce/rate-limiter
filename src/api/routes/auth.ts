import type { FastifyPluginAsync } from "fastify";
import * as authHandler from "../request-handlers/auth";
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
} from "../validations/auth";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    { schema: registerSchema },
    authHandler.registerHandler,
  );

  fastify.post(
    "/google-auth",
    { schema: googleAuthSchema },
    authHandler.googleAuthHandler,
  );

  fastify.post("/login", { schema: loginSchema }, authHandler.loginHandler);
};
