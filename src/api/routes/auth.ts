import type { FastifyPluginAsync } from "fastify";
import * as authHandler from "../request-handlers/auth";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/register", authHandler.registerHandler);
};
