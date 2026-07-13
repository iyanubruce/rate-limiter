import type { FastifyReply, FastifyRequest } from "fastify";
import * as webhookController from "../controllers/webhooks";
import { BadRequestError } from "../../error";

export const createWebhook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) throw new BadRequestError("Unauthorized");

    const data = await webhookController.createWebhook(
      userId,
      request.body as any,
    );
    return reply.code(201).send(data);
  } catch (error) {
    throw error;
  }
};

export const listWebhooks = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) throw new BadRequestError("Unauthorized");

    const data = await webhookController.listWebhooks(userId);
    return reply.code(200).send(data);
  } catch (error) {
    throw error;
  }
};

export const getWebhook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) throw new BadRequestError("Unauthorized");

    const { webhookId } = request.params as { webhookId: string };
    const data = await webhookController.getWebhook(userId, Number(webhookId));
    return reply.code(200).send(data);
  } catch (error) {
    throw error;
  }
};

export const updateWebhook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) throw new BadRequestError("Unauthorized");

    const { webhookId } = request.params as { webhookId: string };
    const data = await webhookController.updateWebhook(
      userId,
      Number(webhookId),
      request.body as any,
    );
    return reply.code(200).send(data);
  } catch (error) {
    throw error;
  }
};

export const deleteWebhook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const userId = request.user?.id;
    if (!userId) throw new BadRequestError("Unauthorized");

    const { webhookId } = request.params as { webhookId: string };
    await webhookController.deleteWebhook(userId, Number(webhookId));
    return reply.code(200).send({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    throw error;
  }
};
