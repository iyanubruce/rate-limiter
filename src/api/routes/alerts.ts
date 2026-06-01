import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import { db } from "../../config/database";
import { alerts, webhooks } from "../../database/models";
import { eq, and, desc } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError } from "../../error";

const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/alerts",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { limit, offset, isActive } = request.query as {
        limit?: number;
        offset?: number;
        isActive?: boolean;
      };

      const conditions = [eq(alerts.userId, userId)];
      if (isActive !== undefined) {
        conditions.push(eq(alerts.isActive, isActive));
      }

      const userAlerts = await db().select().from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.createdAt))
        .limit(limit || 50)
        .offset(offset || 0);

      return reply.code(200).send({ alerts: userAlerts, count: userAlerts.length });
    }
  );

  fastify.post(
    "/v1/alerts",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "channel", "type", "threshold"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            channel: { type: "string", enum: ["email", "webhook", "slack", "discord"] },
            type: { type: "string", enum: ["quota_warning", "quota_exceeded", "rate_limited", "anomaly_detected"] },
            threshold: { type: "integer", minimum: 1, maximum: 100 },
            config: { type: "object" },
            isActive: { type: "boolean", default: true },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { name, channel, type, threshold, config, isActive } = request.body as {
        name: string;
        channel: string;
        type: string;
        threshold: number;
        config?: object;
        isActive?: boolean;
      };

      const [newAlert] = await db().insert(alerts).values({
        userId,
        name,
        channel,
        type,
        threshold,
        config: config || {},
        isActive: isActive ?? true,
      }).returning();

      return reply.code(201).send(newAlert);
    }
  );

  fastify.put(
    "/v1/alerts/:alertId",
    {
      schema: {
        params: {
          type: "object",
          required: ["alertId"],
          properties: { alertId: { type: "integer" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 255 },
            channel: { type: "string", enum: ["email", "webhook", "slack", "discord"] },
            type: { type: "string", enum: ["quota_warning", "quota_exceeded", "rate_limited", "anomaly_detected"] },
            threshold: { type: "integer", minimum: 1, maximum: 100 },
            config: { type: "object" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { alertId } = request.params as { alertId: string };
      const data = request.body as Partial<{
        name: string;
        channel: string;
        type: string;
        threshold: number;
        config: object;
        isActive: boolean;
      }>;

      const [updated] = await db().update(alerts)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(alerts.id, Number(alertId)), eq(alerts.userId, userId)))
        .returning();

      if (!updated) {
        throw new ResourceNotFoundError("Alert not found");
      }

      return reply.code(200).send(updated);
    }
  );

  fastify.delete(
    "/v1/alerts/:alertId",
    {
      schema: {
        params: {
          type: "object",
          required: ["alertId"],
          properties: { alertId: { type: "integer" } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { alertId } = request.params as { alertId: string };

      const [deleted] = await db().delete(alerts)
        .where(and(eq(alerts.id, Number(alertId)), eq(alerts.userId, userId)))
        .returning();

      if (!deleted) {
        throw new ResourceNotFoundError("Alert not found");
      }

      return reply.code(200).send({ success: true, message: "Alert deleted" });
    }
  );

  fastify.get(
    "/v1/webhooks",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { limit, offset, isActive } = request.query as {
        limit?: number;
        offset?: number;
        isActive?: boolean;
      };

      const conditions = [eq(webhooks.userId, userId)];
      if (isActive !== undefined) {
        conditions.push(eq(webhooks.isActive, isActive));
      }

      const userWebhooks = await db().select().from(webhooks)
        .where(and(...conditions))
        .orderBy(desc(webhooks.createdAt))
        .limit(limit || 50)
        .offset(offset || 0);

      return reply.code(200).send({ webhooks: userWebhooks, count: userWebhooks.length });
    }
  );

  fastify.post(
    "/v1/webhooks",
    {
      schema: {
        body: {
          type: "object",
          required: ["url", "events"],
          properties: {
            url: { type: "string", format: "uri", maxLength: 500 },
            events: {
              type: "array",
              items: {
                type: "string",
                enum: ["quota_warning", "quota_exceeded", "rate_limited", "anomaly_detected", "strategy_changed"],
              },
              minItems: 1,
            },
            secret: { type: "string", maxLength: 255 },
            headers: { type: "object" },
            isActive: { type: "boolean", default: true },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { url, events, secret, headers, isActive } = request.body as {
        url: string;
        events: string[];
        secret?: string;
        headers?: object;
        isActive?: boolean;
      };

      const [newWebhook] = await db().insert(webhooks).values({
        userId,
        url,
        events,
        secret,
        headers: headers || {},
        isActive: isActive ?? true,
      }).returning();

      return reply.code(201).send(newWebhook);
    }
  );

  fastify.put(
    "/v1/webhooks/:webhookId",
    {
      schema: {
        params: {
          type: "object",
          required: ["webhookId"],
          properties: { webhookId: { type: "integer" } },
        },
        body: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri", maxLength: 500 },
            events: {
              type: "array",
              items: { type: "string" },
            },
            secret: { type: "string", maxLength: 255 },
            headers: { type: "object" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { webhookId } = request.params as { webhookId: string };
      const data = request.body as Partial<{
        url: string;
        events: string[];
        secret: string;
        headers: object;
        isActive: boolean;
      }>;

      const [updated] = await db().update(webhooks)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(webhooks.id, Number(webhookId)), eq(webhooks.userId, userId)))
        .returning();

      if (!updated) {
        throw new ResourceNotFoundError("Webhook not found");
      }

      return reply.code(200).send(updated);
    }
  );

  fastify.delete(
    "/v1/webhooks/:webhookId",
    {
      schema: {
        params: {
          type: "object",
          required: ["webhookId"],
          properties: { webhookId: { type: "integer" } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { webhookId } = request.params as { webhookId: string };

      const [deleted] = await db().delete(webhooks)
        .where(and(eq(webhooks.id, Number(webhookId)), eq(webhooks.userId, userId)))
        .returning();

      if (!deleted) {
        throw new ResourceNotFoundError("Webhook not found");
      }

      return reply.code(200).send({ success: true, message: "Webhook deleted" });
    }
  );

  fastify.post(
    "/v1/webhooks/:webhookId/test",
    {
      schema: {
        params: {
          type: "object",
          required: ["webhookId"],
          properties: { webhookId: { type: "integer" } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        throw new ResourceNotFoundError("User not found");
      }

      const { webhookId } = request.params as { webhookId: string };

      const webhook = await db().query.webhooks.findFirst({
        where: and(eq(webhooks.id, Number(webhookId)), eq(webhooks.userId, userId)),
      });

      if (!webhook) {
        throw new ResourceNotFoundError("Webhook not found");
      }

      const testPayload = {
        type: "test",
        webhookId: webhook.id,
        timestamp: Date.now(),
        message: "This is a test webhook from RateLimitr",
      };

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhook.headers as Record<string, string>),
          },
          body: JSON.stringify(testPayload),
        });

        return reply.code(200).send({
          success: response.ok,
          statusCode: response.status,
          message: response.ok ? "Webhook test successful" : "Webhook test failed",
        });
      } catch (error) {
        return reply.code(200).send({
          success: false,
          statusCode: 0,
          message: "Failed to reach webhook endpoint",
        });
      }
    }
  );
};

export default alertsRoutes;
