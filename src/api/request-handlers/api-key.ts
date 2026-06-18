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
      request.user?.id!,
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
    const tenantId = request.user?.tenantId;
    const data = await apiKeyController.createKey(
      request.body as CreateKeyInput,
      userId!,
      tenantId!,
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
    const tenantId = request.user?.tenantId;
    if (!userId || !tenantId) {
      throw new BadRequestError("Unauthorized");
    }
    const { keyId } = request.params as { keyId: string };
    const data = await apiKeyController.updateKey(
      Number(keyId),
      userId,
      tenantId,
      request.body as {
        name?: string;
        description?: string;
        scopes?: string[];
        rateLimitOverride?: {
          strategy?: "token-bucket" | "sliding-window" | "fixed-window";
          requestsPerSecond?: number;
          burstSize?: number;
        } | null;
      },
    );
    return reply.code(200).send(data);
  } catch (error) {
    throw error;
  }
};

export const getKey = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { keyId } = request.params as { keyId: string };
    const userId = request.user?.id;
    const key = await apiKeyController.getKeyById(Number(keyId), userId!);
    return reply.code(200).send(key);
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

    const { keyId } = request.params as { keyId: string };
    await apiKeyController.deleteKey(Number(keyId), userId!);
    return reply.code(200).send({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    throw error;
  }
};
