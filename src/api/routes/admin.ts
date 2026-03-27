import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import { db } from "../../config/database";
import { tenants, users, rateLimitEvents, apiKeys } from "../../database/models";
import { eq, desc, count, sql } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError } from "../../error";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", validateAccessToken);

  fastify.get(
    "/v1/admin/tenants",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
            plan: { type: "string", enum: ["free", "pro", "enterprise"] },
            isActive: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              tenants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                    email: { type: "string" },
                    plan: { type: "string" },
                    quota: { type: "integer" },
                    strategy: { type: "string" },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string" },
                  },
                },
              },
              total: { type: "integer" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { limit, offset, plan, isActive } = request.query as {
        limit?: number;
        offset?: number;
        plan?: string;
        isActive?: boolean;
      };

      const allTenants = await db().select().from(tenants)
        .orderBy(desc(tenants.createdAt))
        .limit(limit || 50)
        .offset(offset || 0);

      const countResult = await db().select({ total: count() }).from(tenants);

      return reply.code(200).send({ tenants: allTenants, total: countResult[0]?.total || 0 });
    }
  );

  fastify.get(
    "/v1/admin/tenants/:tenantId",
    {
      schema: {
        params: {
          type: "object",
          required: ["tenantId"],
          properties: { tenantId: { type: "integer" } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request.params as { tenantId: string };

      const tenant = await db().query.tenants.findFirst({
        where: eq(tenants.id, Number(tenantId)),
      });

      if (!tenant) {
        throw new ResourceNotFoundError("Tenant not found");
      }

      const [apiKeyCount] = await db().select({ count: count() }).from(apiKeys)
        .where(eq(apiKeys.tenantId, Number(tenantId)));

      const [requestStats] = await db().select({
        totalRequests: count(),
        blockedRequests: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
      }).from(rateLimitEvents);

      return reply.code(200).send({
        tenant,
        stats: {
          apiKeyCount: apiKeyCount?.count || 0,
          totalRequests: requestStats?.totalRequests || 0,
          blockedRequests: Number(requestStats?.blockedRequests) || 0,
        },
      });
    }
  );

  fastify.post(
    "/v1/admin/tenants/:tenantId/override",
    {
      schema: {
        params: {
          type: "object",
          required: ["tenantId"],
          properties: { tenantId: { type: "integer" } },
        },
        body: {
          type: "object",
          properties: {
            quota: { type: "integer", minimum: 1 },
            strategy: { type: "string", enum: ["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"] },
            windowSeconds: { type: "integer", minimum: 1 },
            isActive: { type: "boolean" },
            reason: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              previousValue: { type: "object" },
              newValue: { type: "object" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request.params as { tenantId: string };
      const { quota, strategy, windowSeconds, isActive, reason } = request.body as {
        quota?: number;
        strategy?: string;
        windowSeconds?: number;
        isActive?: boolean;
        reason?: string;
      };

      const tenant = await db().query.tenants.findFirst({
        where: eq(tenants.id, Number(tenantId)),
      });

      if (!tenant) {
        throw new ResourceNotFoundError("Tenant not found");
      }

      const previousValue = {
        quota: tenant.quota,
        strategy: tenant.strategy,
        windowSeconds: tenant.windowSeconds,
        isActive: tenant.isActive,
      };

      const updateData: Partial<typeof tenant> = {};
      if (quota !== undefined) updateData.quota = quota;
      if (strategy !== undefined) updateData.strategy = strategy;
      if (windowSeconds !== undefined) updateData.windowSeconds = windowSeconds;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updated] = await db().update(tenants)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(tenants.id, Number(tenantId)))
        .returning();

      return reply.code(200).send({
        success: true,
        previousValue,
        newValue: updated,
        message: reason || "Quota override applied",
      });
    }
  );

  fastify.get(
    "/v1/admin/stats",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const [
        totalUsers,
        totalTenants,
        totalApiKeys,
        totalRequests,
        blockedRequests,
      ] = await Promise.all([
        db().select({ count: count() }).from(users),
        db().select({ count: count() }).from(tenants),
        db().select({ count: count() }).from(apiKeys),
        db().select({ count: count() }).from(rateLimitEvents)
          .where(sql`time >= ${start} AND time <= ${end}`),
        db().select({ count: count() }).from(rateLimitEvents)
          .where(sql`is_blocked = true AND time >= ${start} AND time <= ${end}`),
      ]);

      return reply.code(200).send({
        period: { start: start.toISOString(), end: end.toISOString() },
        stats: {
          totalUsers: totalUsers[0]?.count || 0,
          totalTenants: totalTenants[0]?.count || 0,
          totalApiKeys: totalApiKeys[0]?.count || 0,
          totalRequests: totalRequests[0]?.count || 0,
          blockedRequests: blockedRequests[0]?.count || 0,
        },
      });
    }
  );
};

export default adminRoutes;
