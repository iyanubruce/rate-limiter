import logger from "../../utils/logger";
import * as authController from "../controllers/auth";

export const registerHandler = async (request: any, reply: any) => {
  try {
    const { email, password, firstName, lastName } = request.body;
    const result = await authController.register(
      email,
      password,
      firstName,
      lastName,
    );
    return reply.code(201).send({ user: result.user, token: result.token });
  } catch (error) {
    logger.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  }
};

export const loginHandler = async (request: any, reply: any) => {
  try {
    const { email, password } = request.body;
    const result = await authController.login(email, password);
    return reply.code(200).send({ user: result.user, token: result.token });
  } catch (error) {
    logger.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  }
};
