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
    // fastify.addHook("preHandler", validateAccessToken);

    fastify.get("/keys", { schema: listKeysSchema }, apiKeyHandler.listKeys);

    fastify.post("/", { schema: createKeySchema }, apiKeyHandler.createKey);

    fastify.get("/:keyId", { schema: getKeySchema }, apiKeyHandler.getKey);

    fastify.patch(
      "/:keyId",
      {
        schema: updateKeySchema,
      },
      apiKeyHandler.updateKey,
    );

    fastify.delete(
      "/:keyId",
      {
        schema: deleteKeySchema,
      },
      apiKeyHandler.deleteKey,
    );
  });
};

export default apiKeyRoutes;
