import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import { db } from "../../config/database";
import { rateLimitEvents, rateLimitRules, alerts, webhooks, apiKeys } from "../../database/models";
import { eq, desc, count, and, gte } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";

const graphqlRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/v1/graphql",
    {
      schema: {
        body: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            variables: { type: "object" },
            operationName: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { query, variables } = request.body as {
        query: string;
        variables?: Record<string, any>;
        operationName?: string;
      };

      try {
        const result = await executeGraphQL(query, variables, { db: db(), user: request.user });
        return reply.code(200).send(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "GraphQL execution failed";
        return reply.code(400).send({
          errors: [{ message: errorMessage }],
          data: null,
        });
      }
    }
  );

  fastify.get(
    "/v1/graphql/schema",
    {
      schema: {
        description: "Get GraphQL schema introspection",
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "object" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({
        data: {
          __schema: {
            queryType: { name: "Query" },
            types: [
              {
                name: "Query",
                fields: [
                  { name: "events", description: "Query rate limit events" },
                  { name: "quotas", description: "Get quota information" },
                ],
              },
            ],
          },
        },
      });
    }
  );
};

interface GraphQLContext {
  db: ReturnType<typeof db>;
  user?: any;
}

async function executeGraphQL(
  query: string,
  variables?: Record<string, any>,
  context?: GraphQLContext
): Promise<{ data?: any; errors?: any[] }> {
  const lowerQuery = query.toLowerCase().trim();

  try {
    if (lowerQuery.includes("events") && lowerQuery.includes("query")) {
      const { events } = variables || {};
      const filters = events || {};

      const conditions = [];
      if (filters.blocked !== undefined) {
        conditions.push(eq(rateLimitEvents.isBlocked, filters.blocked));
      }
      if (filters.startDate) {
        conditions.push(gte(rateLimitEvents.time, new Date(filters.startDate)));
      }

      const eventList = await context!.db.select().from(rateLimitEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(rateLimitEvents.time))
        .limit(filters.limit || 50);

      return {
        data: {
          events: eventList.map(e => ({
            id: e.id,
            timestamp: e.time?.toISOString(),
            endpoint: e.endpoint,
            ipAddress: e.ipAddress,
            isBlocked: e.isBlocked,
            remainingQuota: e.remainingQuota,
          })),
        },
      };
    }

    if (lowerQuery.includes("quotas") && lowerQuery.includes("query")) {
      const userId = context?.user?.id;
      if (!userId) {
        return { errors: [{ message: "Authentication required" }] };
      }

      const keys = await context!.db.select().from(apiKeys)
        .where(eq(apiKeys.userId, userId));

      return {
        data: {
          quotas: keys.map(k => ({
            apiKeyId: k.id,
            name: k.name,
            limit: (k.rateLimitOverride as any)?.requestsPerSecond || 1000,
            used: 0,
            remaining: 0,
          })),
        },
      };
    }

    if (lowerQuery.includes("rules") && lowerQuery.includes("query")) {
      const userId = context?.user?.id;
      if (!userId) {
        return { errors: [{ message: "Authentication required" }] };
      }

      const rules = await context!.db.select().from(rateLimitRules)
        .where(eq(rateLimitRules.userId, userId));

      return {
        data: {
          rules: rules.map(r => ({
            id: r.id,
            name: r.name,
            strategy: r.strategy,
            limit: r.limit,
            windowMs: r.windowMs,
            isActive: r.isActive,
          })),
        },
      };
    }

    return { data: {} };
  } catch (error) {
    return {
      errors: [{ message: error instanceof Error ? error.message : "Unknown error" }],
    };
  }
}

export default graphqlRoutes;
