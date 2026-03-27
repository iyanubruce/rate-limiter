import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../config/database";
import ApiKeyRepo from "../../database/repositories/api-keys";
import UserRepo from "../../database/repositories/user";

export const apiKeyAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const keyHeader = request.headers["x-api-key"] as string | undefined;

  if (!keyHeader) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Missing x-api-key header",
    });
  }

  const database = db();
  const apiKeyRepo = new ApiKeyRepo(database);
  const userRepo = new UserRepo(database);

  // Find the API key
  const apiKeyEntry = await apiKeyRepo.getApiKeyByKeyHash(keyHeader);

  if (!apiKeyEntry) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  // Find the associated user
  const userEntry = await userRepo.getUserById(apiKeyEntry.userId);

  if (!userEntry) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  // Attach the API key and User to the request object
  request.apiKey = apiKeyEntry;
  request.user = userEntry;
};
