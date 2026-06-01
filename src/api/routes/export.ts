import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import { db } from "../../config/database";
import { rateLimitEvents, users, apiKeys, rateLimitRules } from "../../database/models";
import { eq, gte, lte, and, desc, count } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError } from "../../error";

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/export/events",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["json", "csv"], default: "json" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            isBlocked: { type: "boolean" },
            limit: { type: "integer", minimum: 1, maximum: 100000, default: 10000 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { format, startDate, endDate, isBlocked, limit } = request.query as {
        format?: string;
        startDate?: string;
        endDate?: string;
        isBlocked?: boolean;
        limit?: number;
      };

      const conditions = [eq(rateLimitEvents.userId, userId)];
      if (startDate) {
        conditions.push(gte(rateLimitEvents.time, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(rateLimitEvents.time, new Date(endDate)));
      }
      if (isBlocked !== undefined) {
        conditions.push(eq(rateLimitEvents.isBlocked, isBlocked));
      }

      const events = await db().select().from(rateLimitEvents)
        .where(and(...conditions))
        .orderBy(desc(rateLimitEvents.time))
        .limit(limit || 10000);

      if (format === "csv") {
        const headers = ["id", "time", "ip_address", "endpoint", "method", "status_code", "is_blocked", "block_reason", "remaining_quota", "request_duration_ms"];
        const csvRows = [headers.join(",")];
        
        for (const event of events) {
          const row = [
            event.id,
            event.time?.toISOString() || "",
            event.ipAddress,
            event.endpoint,
            event.method,
            event.statusCode,
            event.isBlocked,
            event.blockReason || "",
            event.remainingQuota || "",
            event.requestDurationMs || "",
          ];
          csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
        }

        return reply
          .header("Content-Type", "text/csv")
          .header("Content-Disposition", `attachment; filename="rate_limit_events_${Date.now()}.csv"`)
          .send(csvRows.join("\n"));
      }

      return reply.code(200).send({
        count: events.length,
        events,
        exportedAt: new Date().toISOString(),
      });
    }
  );

  fastify.delete(
    "/v1/gdpr/delete",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            confirmDeletion: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              deletedRecords: {
                type: "object",
                properties: {
                  events: { type: "integer" },
                  apiKeys: { type: "integer" },
                  rules: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { confirmDeletion } = request.query as { confirmDeletion?: boolean };

      if (!confirmDeletion) {
        return reply.code(400).send({
          error: true,
          message: "Please confirm deletion by setting confirmDeletion=true",
        });
      }

      const deletedEvents = await db().delete(rateLimitEvents)
        .where(eq(rateLimitEvents.userId, userId))
        .returning();

      const deletedApiKeys = await db().delete(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .returning();

      const deletedRules = await db().delete(rateLimitRules)
        .where(eq(rateLimitRules.userId, userId))
        .returning();

      const deletedUser = await db().delete(users)
        .where(eq(users.id, userId))
        .returning();

      return reply.code(200).send({
        success: true,
        message: "All user data has been permanently deleted in compliance with GDPR",
        deletedRecords: {
          events: deletedEvents.length,
          apiKeys: deletedApiKeys.length,
          rules: deletedRules.length,
          user: deletedUser.length,
        },
        deletedAt: new Date().toISOString(),
      });
    }
  );

  fastify.get(
    "/v1/gdpr/data-summary",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  email: { type: "string" },
                  createdAt: { type: "string" },
                },
              },
              dataCounts: {
                type: "object",
                properties: {
                  events: { type: "integer" },
                  apiKeys: { type: "integer" },
                  rules: { type: "integer" },
                  alerts: { type: "integer" },
                  webhooks: { type: "integer" },
                },
              },
              oldestRecord: { type: "string", nullable: true },
              newestRecord: { type: "string", nullable: true },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const user = await db().query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, email: true, created_at: true },
      });

      if (!user) {
        throw new ResourceNotFoundError("User not found");
      }

      const [oldestEvent] = await db().select({ time: rateLimitEvents.time })
        .from(rateLimitEvents)
        .where(eq(rateLimitEvents.userId, userId))
        .orderBy(rateLimitEvents.time)
        .limit(1);

      const [newestEvent] = await db().select({ time: rateLimitEvents.time })
        .from(rateLimitEvents)
        .where(eq(rateLimitEvents.userId, userId))
        .orderBy(desc(rateLimitEvents.time))
        .limit(1);

      const eventCountResult = await db().select({ count: count() }).from(rateLimitEvents)
        .where(eq(rateLimitEvents.userId, userId));

      return reply.code(200).send({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at?.toISOString(),
        },
        dataCounts: {
          events: eventCountResult[0]?.count || 0,
          apiKeys: 0,
          rules: 0,
          alerts: 0,
          webhooks: 0,
        },
        oldestRecord: oldestEvent?.time?.toISOString() || null,
        newestRecord: newestEvent?.time?.toISOString() || null,
      });
    }
  );
};

export default exportRoutes;
