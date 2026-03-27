import type {
  ListKeysInterface,
  CreateKeyInput,
} from "../../interfaces/api-key";
import * as apiKeyController from "../controllers/api-key";
import type { FastifyReply, FastifyRequest } from "fastify";
import { BadRequestError } from "../../error";

export const listKeys = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const data = await apiKeyController.listKeys(
      request.query as ListKeysInterface,
    );
    return reply.code(200).send(data);
  } catch (error) {
    throw error;
  }
};

export const createKey = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    const data = await apiKeyController.createKey(
      request.body as CreateKeyInput,
      userId!,
    );
    return reply.code(201).send(data);
  } catch (error) {
    throw error;
  }
};

export const updateKey = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError("Unauthorized");
    }
    const { keyId } = request.params as { keyId: string };
    const data = await apiKeyController.updateKey(
      Number(keyId),
      userId,
      request.body as {
        name?: string;
        description?: string;
        scopes?: string[];
        rateLimitOverride?: { requestsPerSecond?: number; burstSize?: number } | null;
      },
    );
    return reply.code(200).send(data);
  } catch (error) {
    throw error;
  }
};

export const deleteKey = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError("Unauthorized");
    }
    const { keyId } = request.params as { keyId: string };
    await apiKeyController.deleteKey(Number(keyId), userId);
    return reply.code(200).send({
      success: true,
      message: "API key revoked successfully",
      keyId: Number(keyId),
    });
  } catch (error) {
    throw error;
  }
};

export const getKey = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { keyId } = request.params as { keyId: string };
    const key = await apiKeyController.getKeyById(Number(keyId));
    if (!key) {
      throw new BadRequestError("API key not found");
    }
    return reply.code(200).send(key);
  } catch (error) {
    throw error;
  }
};
