import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../../middleware/validate-access-token";
import * as webhookHandler from "../../request-handlers/webhooks";
import {
  createWebhookSchema,
  updateWebhookSchema,
  listWebhooksSchema,
  getWebhookSchema,
  deleteWebhookSchema,
} from "../../validations/webhooks";

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", validateAccessToken);

  fastify.post("/", { schema: createWebhookSchema }, webhookHandler.createWebhook);
  fastify.get("/", { schema: listWebhooksSchema }, webhookHandler.listWebhooks);
  fastify.get("/:webhookId", { schema: getWebhookSchema }, webhookHandler.getWebhook);
  fastify.patch("/:webhookId", { schema: updateWebhookSchema }, webhookHandler.updateWebhook);
  fastify.delete("/:webhookId", { schema: deleteWebhookSchema }, webhookHandler.deleteWebhook);
};

export default webhookRoutes;
