import JWT from "../../helpers/jwt";
import { NotAuthorizedError } from "../../error";
import UserRepo from "../../database/repositories/user";
import { db } from "../../config/database";
import type { FastifyRequest, FastifyReply } from "fastify";
const userRepository = new UserRepo(db());

export const validateAccessToken = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    throw new NotAuthorizedError("Unauthorized");
  }

  try {
    const decodedToken = JWT.verify(token);
    const user = await userRepository.findById(decodedToken.userId);

    if (!user) {
      throw new NotAuthorizedError("Unauthorized");
    }

    req.user = user;
  } catch (err) {
    throw err;
  }
};
