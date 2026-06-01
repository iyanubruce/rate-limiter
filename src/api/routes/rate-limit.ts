import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import {
  checkRateLimitSchema,
  createRuleSchema,
  listRulesSchema,
  updateRuleSchema,
  deleteRuleSchema,
  getQuotaStatusSchema,
  checkRateLimitPostSchema,
  batchCheckSchema,
} from "../validations/rate-limit";
import * as rateLimitHandler from "../request-handlers/rate-limit";

const rateLimitRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/check",
    {
      schema: checkRateLimitSchema,
    },
    rateLimitHandler.checkRateLimit,
  );

  fastify.post(
    "/v1/check",
    {
      schema: checkRateLimitPostSchema,
    },
    rateLimitHandler.checkRateLimitPost,
  );

  fastify.post(
    "/v1/check/batch",
    {
      schema: batchCheckSchema,
    },
    rateLimitHandler.batchCheckRateLimit,
  );

  fastify.get(
    "/v1/rules",
    {
      schema: listRulesSchema,
      preHandler: validateAccessToken,
    },
    rateLimitHandler.listRules,
  );

  fastify.post(
    "/v1/rules",
    {
      schema: createRuleSchema,
      preHandler: validateAccessToken,
    },
    rateLimitHandler.createRule,
  );

  fastify.get(
    "/v1/rules/:ruleId",
    {
      schema: {
        params: {
          type: "object",
          required: ["ruleId"],
          properties: { ruleId: { type: "integer" } },
        },
      },
      preHandler: validateAccessToken,
    },
    rateLimitHandler.getRule,
  );

  fastify.put(
    "/v1/rules/:ruleId",
    {
      schema: updateRuleSchema,
      preHandler: validateAccessToken,
    },
    rateLimitHandler.updateRule,
  );

  fastify.patch(
    "/v1/rules/:ruleId/strategy",
    {
      schema: {
        params: {
          type: "object",
          required: ["ruleId"],
          properties: { ruleId: { type: "integer" } },
        },
        body: {
          type: "object",
          required: ["strategy"],
          properties: {
            strategy: {
              type: "string",
              enum: ["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"],
            },
          },
        },
      },
      preHandler: validateAccessToken,
    },
    rateLimitHandler.swapRuleStrategy,
  );

  fastify.delete(
    "/v1/rules/:ruleId",
    {
      schema: deleteRuleSchema,
      preHandler: validateAccessToken,
    },
    rateLimitHandler.deleteRule,
  );

  fastify.get(
    "/v1/quota",
    {
      schema: getQuotaStatusSchema,
    },
    rateLimitHandler.getQuotaStatus,
  );

  fastify.get(
    "/v1/quotas/:apiKeyId",
    {
      schema: {
        params: {
          type: "object",
          required: ["apiKeyId"],
          properties: { apiKeyId: { type: "integer" } },
        },
      },
      preHandler: validateAccessToken,
    },
    rateLimitHandler.getQuotaForKey,
  );

  fastify.patch(
    "/v1/quotas/:apiKeyId",
    {
      schema: {
        params: {
          type: "object",
          required: ["apiKeyId"],
          properties: { apiKeyId: { type: "integer" } },
        },
        body: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1 },
            windowSeconds: { type: "integer", minimum: 1 },
            strategy: { type: "string" },
          },
        },
      },
      preHandler: validateAccessToken,
    },
    rateLimitHandler.updateQuotaForKey,
  );
};

export default rateLimitRoutes;
