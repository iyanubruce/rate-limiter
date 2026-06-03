import type { FastifyPluginAsync } from "fastify";
import {
  listKeysSchema,
  createKeySchema,
  updateKeySchema,
  deleteKeySchema,
  getKeySchema,
} from "../validations/api-key";
import * as apiKeyHandler from "../request-handlers/api-key";
import { validateAccessToken } from "../middleware/validate-access-token";

const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(async (fastify) => {
    fastify.addHook("preHandler", validateAccessToken);

    fastify.post("/keys", { schema: createKeySchema }, apiKeyHandler.createKey);

    fastify.get("/keys", { schema: listKeysSchema }, apiKeyHandler.listKeys);

    fastify.get("/keys/:keyId", { schema: getKeySchema }, apiKeyHandler.getKey);

    fastify.patch(
      "/keys/:keyId",
      {
        schema: updateKeySchema,
      },
      apiKeyHandler.updateKey,
    );

    fastify.delete(
      "/keys/:keyId",
      {
        schema: deleteKeySchema,
      },
      apiKeyHandler.deleteKey,
    );
  });
};

export default apiKeyRoutes;
