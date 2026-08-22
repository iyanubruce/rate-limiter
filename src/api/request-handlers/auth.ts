import logger from "../../utils/logger";
import * as authController from "../controllers/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

export const registerHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const {
      email,
      password,
      organizationEmail,
      organizationName,
      firstName,
      lastName,
    } = request.body as {
      email: string;
      password: string;
      organizationEmail: string;
      organizationName: string;
      firstName: string;
      lastName: string;
    };
    const result = await authController.register(
      email,
      password,
      organizationEmail,
      organizationName,
      firstName,
      lastName,
    );
    return reply.code(201).send({ user: result.user, token: result.token });
  } catch (error) {
    throw error;
  }
};

export const loginHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };
    logger.log("Guest user auth", email, password);
    const result = await authController.login(email, password);
    return reply.code(200).send({ user: result.user, token: result.token });
  } catch (error) {
    throw error;
  }
};

export const refreshHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { token } = request.body as {
      token: string;
    };
    const result = await authController.refresh(token);
    return reply.code(200).send(result);
  } catch (error) {
    throw error;
  }
};
