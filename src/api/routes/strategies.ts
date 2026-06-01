import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import { db } from "../../config/database";
import { rateLimitRules } from "../../database/models";
import { eq, and } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError } from "../../error";

const STRATEGIES = [
  {
    name: "token_bucket",
    description: "Allows burst traffic while maintaining average rate limit. Best for APIs with variable traffic patterns.",
    pros: ["Handles burst traffic well", "Fair resource distribution", "Predictable behavior"],
    cons: ["More complex implementation", "Higher memory usage"],
  },
  {
    name: "sliding_window",
    description: "Rolling window provides smooth rate limiting. Best for APIs requiring consistent rate limiting.",
    pros: ["Smoother rate limiting", "No boundary issues", "Accurate limiting"],
    cons: ["Higher Redis memory usage", "Slightly slower"],
  },
  {
    name: "leaky_bucket",
    description: "Processes requests at a constant rate. Best for rate limiting producers to protect consumers.",
    pros: ["Constant output rate", "Memory efficient", "Prevents queue buildup"],
    cons: ["May add latency", "Not ideal for burst traffic"],
  },
  {
    name: "fixed_window",
    description: "Simple time-window based limiting. Best for basic rate limiting with minimal overhead.",
    pros: ["Simple implementation", "Low memory usage", "Fast execution"],
    cons: ["Boundary issues at window edges", "Less accurate"],
  },
];

const strategiesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/strategies",
    {
      schema: {
        description: "List all available rate limiting strategies",
        tags: ["Strategies"],
        response: {
          200: {
            type: "object",
            properties: {
              strategies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    pros: { type: "array", items: { type: "string" } },
                    cons: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({ strategies: STRATEGIES });
    }
  );

  fastify.get(
    "/v1/strategies/active",
    {
      schema: {
        description: "Get the currently active rate limiting strategy",
        tags: ["Strategies"],
        querystring: {
          type: "object",
          properties: {
            userId: { type: "integer" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              strategy: { type: "string" },
              isDefault: { type: "boolean" },
              userRule: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                  strategy: { type: "string" },
                  limit: { type: "integer" },
                  windowMs: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.query as { userId?: number };

      if (userId) {
        const userRule = await db().query.rateLimitRules.findFirst({
          where: and(eq(rateLimitRules.userId, userId), eq(rateLimitRules.isActive, true)),
          columns: {
            id: true,
            name: true,
            strategy: true,
            limit: true,
            windowMs: true,
          },
        });

        if (userRule) {
          return reply.code(200).send({
            strategy: userRule.strategy,
            isDefault: false,
            userRule,
          });
        }
      }

      const defaultStrategy = process.env.DEFAULT_STRATEGY || "token_bucket";
      return reply.code(200).send({
        strategy: defaultStrategy,
        isDefault: true,
        userRule: null,
      });
    }
  );

  fastify.post(
    "/v1/strategies/swap",
    {
      schema: {
        description: "Hot-swap the active rate limiting strategy without restart",
        tags: ["Strategies"],
        body: {
          type: "object",
          required: ["strategy"],
          properties: {
            strategy: {
              type: "string",
              enum: ["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"],
            },
            userId: { type: "integer" },
            ruleId: { type: "integer" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              previousStrategy: { type: "string" },
              newStrategy: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { strategy, userId, ruleId } = request.body as {
        strategy: string;
        userId?: number;
        ruleId?: number;
      };

      if (ruleId && userId) {
        const rule = await db().query.rateLimitRules.findFirst({
          where: and(eq(rateLimitRules.id, ruleId), eq(rateLimitRules.userId, userId)),
        });

        if (!rule) {
          throw new ResourceNotFoundError("Rule not found");
        }

        await db().update(rateLimitRules)
          .set({ strategy, updatedAt: new Date() })
          .where(eq(rateLimitRules.id, ruleId));

        return reply.code(200).send({
          success: true,
          previousStrategy: rule.strategy,
          newStrategy: strategy,
          message: `Strategy hot-swapped from ${rule.strategy} to ${strategy} for rule ${ruleId}`,
        });
      }

      const currentStrategy = process.env.DEFAULT_STRATEGY || "token_bucket";
      process.env.DEFAULT_STRATEGY = strategy;

      return reply.code(200).send({
        success: true,
        previousStrategy: currentStrategy,
        newStrategy: strategy,
        message: `Default strategy hot-swapped from ${currentStrategy} to ${strategy}`,
      });
    }
  );
};

export default strategiesRoutes;
