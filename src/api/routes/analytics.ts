import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import { db } from "../../config/database";
import { rateLimitEvents } from "../../database/models";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/v1/analytics/overview",
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

      const [totalRequests, blockedRequests, avgDuration, topEndpoints] = await Promise.all([
        db().select({ count: sql<number>`count(*)` }).from(rateLimitEvents)
          .where(and(gte(rateLimitEvents.time, start), lte(rateLimitEvents.time, end))),
        db().select({ count: sql<number>`count(*)` }).from(rateLimitEvents)
          .where(and(eq(rateLimitEvents.isBlocked, true), gte(rateLimitEvents.time, start), lte(rateLimitEvents.time, end))),
        db().select({ avg: sql<number>`avg(request_duration_ms)` }).from(rateLimitEvents)
          .where(and(gte(rateLimitEvents.time, start), lte(rateLimitEvents.time, end))),
        db().select({
          endpoint: rateLimitEvents.endpoint,
          count: sql<number>`count(*)`,
        })
          .from(rateLimitEvents)
          .where(and(gte(rateLimitEvents.time, start), lte(rateLimitEvents.time, end)))
          .groupBy(rateLimitEvents.endpoint)
          .orderBy(desc(sql`count`))
          .limit(10),
      ]);

      const blockRate = (totalRequests[0]?.count ?? 0) > 0 
        ? ((blockedRequests[0]?.count || 0) / (totalRequests[0]?.count || 1)) * 100 
        : 0;

      return reply.code(200).send({
        period: { start: start.toISOString(), end: end.toISOString() },
        totalRequests: totalRequests[0]?.count || 0,
        blockedRequests: blockedRequests[0]?.count || 0,
        blockRate: Math.round(blockRate * 100) / 100,
        avgResponseTimeMs: Math.round((avgDuration[0]?.avg || 0) * 100) / 100,
        topEndpoints,
      });
    }
  );

  fastify.get(
    "/v1/analytics/events",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
            isBlocked: { type: "boolean" },
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { limit, offset, isBlocked, startDate, endDate } = request.query as {
        limit?: number;
        offset?: number;
        isBlocked?: boolean;
        startDate?: string;
        endDate?: string;
      };

      const conditions = [];
      if (isBlocked !== undefined) {
        conditions.push(eq(rateLimitEvents.isBlocked, isBlocked));
      }
      if (startDate) {
        conditions.push(gte(rateLimitEvents.time, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(rateLimitEvents.time, new Date(endDate)));
      }

      const events = await db().select().from(rateLimitEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(rateLimitEvents.time))
        .limit(limit || 50)
        .offset(offset || 0);

      return reply.code(200).send({ events, count: events.length });
    }
  );

  fastify.get(
    "/v1/analytics/timeseries",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            interval: { type: "string", enum: ["1m", "5m", "1h", "1d"], default: "1h" },
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { interval, startDate, endDate } = request.query as {
        interval?: string;
        startDate?: string;
        endDate?: string;
      };

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      let bucketFormat: string;
      switch (interval) {
        case "1m": bucketFormat = "minute"; break;
        case "5m": bucketFormat = "minute"; break;
        case "1h": bucketFormat = "hour"; break;
        case "1d": bucketFormat = "day"; break;
        default: bucketFormat = "hour";
      }

      const intervalMs = {
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
      }[interval || "1h"] ?? (60 * 60 * 1000);

      const buckets = Math.floor((end.getTime() - start.getTime()) / intervalMs);

      const timeseries = await db().select({
        time: sql<Date>`time_bucket('${sql.raw(interval || "1 hour")}', ${rateLimitEvents.time})`.as("bucket"),
        totalRequests: sql<number>`count(*)`,
        blockedRequests: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
        avgDuration: sql<number>`avg(request_duration_ms)`,
      })
        .from(rateLimitEvents)
        .where(and(gte(rateLimitEvents.time, start), lte(rateLimitEvents.time, end)))
        .groupBy(sql`bucket`)
        .orderBy(sql`bucket`);

      return reply.code(200).send({
        interval: interval || "1h",
        buckets,
        timeseries,
      });
    }
  );

  fastify.get(
    "/v1/analytics/top-blocked",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { limit, startDate, endDate } = request.query as {
        limit?: number;
        startDate?: string;
        endDate?: string;
      };

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const topBlocked = await db().select({
        ipAddress: rateLimitEvents.ipAddress,
        endpoint: rateLimitEvents.endpoint,
        blockCount: sql<number>`count(*)`,
        firstBlock: sql<Date>`min(time)`,
        lastBlock: sql<Date>`max(time)`,
      })
        .from(rateLimitEvents)
        .where(and(
          eq(rateLimitEvents.isBlocked, true),
          gte(rateLimitEvents.time, start),
          lte(rateLimitEvents.time, end)
        ))
        .groupBy(rateLimitEvents.ipAddress, rateLimitEvents.endpoint)
        .orderBy(desc(sql`count(*)`))
        .limit(limit || 10);

      return reply.code(200).send({ topBlocked });
    }
  );

  fastify.get(
    "/v1/analytics/patterns",
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

      const patterns = await db().select({
        ipAddress: rateLimitEvents.ipAddress,
        requestCount: sql<number>`count(*)`,
        uniqueEndpoints: sql<number>`count(distinct endpoint)`,
        blockRate: sql<number>`round(avg(case when is_blocked then 1.0 else 0.0 end) * 100, 2)`,
        avgDuration: sql<number>`avg(request_duration_ms)`,
      })
        .from(rateLimitEvents)
        .where(and(gte(rateLimitEvents.time, start), lte(rateLimitEvents.time, end)))
        .groupBy(rateLimitEvents.ipAddress)
        .orderBy(desc(sql`count(*)`))
        .limit(100);

      const suspiciousPatterns = patterns.filter(p => 
        p.blockRate > 50 && p.requestCount > 100
      );

      const burstPatterns = patterns.filter(p =>
        p.uniqueEndpoints > 20 && p.blockRate > 20
      );

      return reply.code(200).send({
        totalUniqueIps: patterns.length,
        suspiciousPatterns,
        burstPatterns,
        topTalkers: patterns.slice(0, 20),
      });
    }
  );
};

export default analyticsRoutes;
