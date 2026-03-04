import * as authController from "../controllers/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

export const registerHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { email, password, firstName, lastName } = request.body as Record<
      string,
      string
    >;
    const result = await authController.register(
      email,
      password,
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
    const result = await authController.login(email, password);
    return reply.code(200).send({ user: result.user, token: result.token });
  } catch (error) {
    throw error;
  }
};
