import { db } from "../../config/database";
import RateLimitRepository from "../../database/repositories/rate-limit-events";
import { rateLimitEvents } from "../../database/models";
import { sql } from "drizzle-orm";
import type {
  GetAnalyticsEventInput,
  GetTimeseriesInput,
  GetTopBlockedInput,
  GetEndpointsInput,
  GetIpAddressesInput,
} from "../../interfaces/analytics";

const rateLimitRepo = new RateLimitRepository(db());

function getDateRange(startDate?: string, endDate?: string) {
  return {
    start: startDate
      ? new Date(startDate)
      : new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate) : new Date(),
  };
}

export async function analyticsOverview(
  tenantId: string,
  startDate?: string,
  endDate?: string,
) {
  const { start, end } = getDateRange(startDate, endDate);

  const baseWhere = {
    tenantId,
    time: { $gte: start, $lte: end } as const,
  };

  const [summary] = await rateLimitRepo.aggregateRateLimitEvents<{
    totalRequests: number;
    blockedRequests: number;
    avgDuration: number | null;
  }>(
    {
      totalRequests: sql<number>`count(*)`,
      blockedRequests: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
      avgDuration: sql<number>`avg(request_duration_ms)`,
    },
    baseWhere,
  );

  const total = await rateLimitRepo.countRateLimitEvent(baseWhere);
  const blocked = await rateLimitRepo.countRateLimitEvent({
    ...baseWhere,
    isBlocked: true,
  });

  const topEndpoints = await rateLimitRepo.aggregateRateLimitEvents<{
    endpoint: string;
    count: number;
    blocked: number;
    avgDuration: number | null;
  }>(
    {
      endpoint: rateLimitEvents.endpoint,
      count: sql<number>`count(*)`,
      blocked: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
      avgDuration: sql<number>`avg(request_duration_ms)`,
    },
    baseWhere,
    {
      groupBy: [sql`${rateLimitEvents.endpoint}`],
      orderBy: sql`count(*) desc`,
      limit: 10,
    },
  );

  const blockRate = total > 0 ? (blocked / total) * 100 : 0;
  const avgDuration = summary?.avgDuration ?? 0;

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalRequests: total,
    blockedRequests: blocked,
    blockRate: Math.round(blockRate * 100) / 100,
    avgResponseTimeMs: Math.round((avgDuration ?? 0) * 100) / 100,
    topEndpoints,
  };
}

export async function analyticsEvents(
  tenantId: string,
  data: GetAnalyticsEventInput,
) {
  const { limit, offset, isBlocked, startDate, endDate } = data;

  const where: Record<string, unknown> = { tenantId };
  if (isBlocked !== undefined) where.isBlocked = isBlocked;
  if (startDate || endDate) {
    where.time = {
      ...(startDate ? { $gte: new Date(startDate) } : {}),
      ...(endDate ? { $lte: new Date(endDate) } : {}),
    };
  }

  const [count, events] = await Promise.all([
    rateLimitRepo.countRateLimitEvent(where as any),
    rateLimitRepo.findRateLimitEvents(where as any, {
      limit: limit || 50,
      offset: offset || 0,
    }),
  ]);

  return { events, totalEvents: count, total: events.length };
}

export async function analyticsTimeseries(
  tenantId: string,
  data: GetTimeseriesInput,
) {
  const { interval, startDate, endDate } = data;
  const { start, end } = getDateRange(startDate, endDate);

  const intervalMs =
    {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
    }[interval || "1h"] ?? 60 * 60 * 1000;

  const buckets = Math.floor((end.getTime() - start.getTime()) / intervalMs);
  const intervalStr = interval || "1 hour";

  const timeseries = await rateLimitRepo.aggregateRateLimitEvents<
    Array<{
      time: Date;
      totalRequests: number;
      blockedRequests: number;
      avgDuration: number | null;
    }>
  >(
    {
      time: sql<Date>`time_bucket(${sql.raw(`'${intervalStr}'`)}, ${rateLimitEvents.time})`.as(
        "bucket",
      ),
      totalRequests: sql<number>`count(*)`,
      blockedRequests: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
      avgDuration: sql<number>`avg(request_duration_ms)`,
    },
    { tenantId, time: { $gte: start, $lte: end } as const },
    {
      groupBy: [sql`bucket`],
      orderBy: sql`bucket`,
    },
  );

  return { interval: interval || "1h", buckets, timeseries };
}

export async function analyticsTopBlocked(
  tenantId: string,
  data: GetTopBlockedInput,
) {
  const { limit, startDate, endDate } = data;
  const { start, end } = getDateRange(startDate, endDate);

  const topBlocked = await rateLimitRepo.aggregateRateLimitEvents<
    Array<{
      ipAddress: string;
      endpoint: string;
      blockCount: number;
      firstBlock: Date;
      lastBlock: Date;
    }>
  >(
    {
      ipAddress: rateLimitEvents.ipAddress,
      endpoint: rateLimitEvents.endpoint,
      blockCount: sql<number>`count(*)`,
      firstBlock: sql<Date>`min(time)`,
      lastBlock: sql<Date>`max(time)`,
    },
    { tenantId, isBlocked: true, time: { $gte: start, $lte: end } as const },
    {
      groupBy: [
        sql`${rateLimitEvents.ipAddress}`,
        sql`${rateLimitEvents.endpoint}`,
      ],
      orderBy: sql`count(*) desc`,
      limit: limit || 10,
    },
  );

  return { topBlocked };
}

export async function analyticsPatterns(
  tenantId: string,
  startDate?: string,
  endDate?: string,
) {
  const { start, end } = getDateRange(startDate, endDate);

  const patterns = await rateLimitRepo.aggregateRateLimitEvents<{
    ipAddress: string;
    requestCount: number;
    uniqueEndpoints: number;
    blockRate: number;
    avgDuration: number | null;
  }>(
    {
      ipAddress: rateLimitEvents.ipAddress,
      requestCount: sql<number>`count(*)`,
      uniqueEndpoints: sql<number>`count(distinct endpoint)`,
      blockRate: sql<number>`round(avg(case when is_blocked then 1.0 else 0.0 end) * 100, 2)`,
      avgDuration: sql<number>`avg(request_duration_ms)`,
    },
    { tenantId, time: { $gte: start, $lte: end } as const },
    {
      groupBy: [sql`${rateLimitEvents.ipAddress}`],
      orderBy: sql`count(*) desc`,
      limit: 100,
    },
  );

  const suspiciousPatterns = patterns.filter(
    (p) => p.blockRate > 50 && p.requestCount > 100,
  );

  const burstPatterns = patterns.filter(
    (p) => p.uniqueEndpoints > 20 && p.blockRate > 20,
  );

  return {
    totalUniqueIps: patterns.length,
    suspiciousPatterns,
    burstPatterns,
    topTalkers: patterns.slice(0, 20),
  };
}

export async function analyticsEndpoints(
  tenantId: string,
  data: GetEndpointsInput,
) {
  const { limit, startDate, endDate } = data;
  const { start, end } = getDateRange(startDate, endDate);

  const endpoints = await rateLimitRepo.aggregateRateLimitEvents<
    Array<{
      endpoint: string;
      method: string;
      totalRequests: number;
      blockedRequests: number;
      blockRate: number;
      avgDuration: number | null;
    }>
  >(
    {
      endpoint: rateLimitEvents.endpoint,
      method: rateLimitEvents.method,
      totalRequests: sql<number>`count(*)`,
      blockedRequests: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
      blockRate: sql<number>`round(avg(case when is_blocked then 1.0 else 0.0 end) * 100, 2)`,
      avgDuration: sql<number>`avg(request_duration_ms)`,
    },
    { tenantId, time: { $gte: start, $lte: end } as const },
    {
      groupBy: [
        sql`${rateLimitEvents.endpoint}`,
        sql`${rateLimitEvents.method}`,
      ],
      orderBy: sql`count(*) desc`,
      limit: limit || 20,
    },
  );

  return { endpoints };
}

export async function analyticsStatusCodes(
  tenantId: string,
  startDate?: string,
  endDate?: string,
) {
  const { start, end } = getDateRange(startDate, endDate);

  const statusCodes = await rateLimitRepo.aggregateRateLimitEvents<
    Array<{
      statusCode: number;
      count: number;
      blocked: number;
    }>
  >(
    {
      statusCode: rateLimitEvents.statusCode,
      count: sql<number>`count(*)`,
      blocked: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
    },
    { tenantId, time: { $gte: start, $lte: end } as const },
    {
      groupBy: [sql`${rateLimitEvents.statusCode}`],
      orderBy: sql`count(*) desc`,
    },
  );

  return { statusCodes };
}

export async function analyticsIpAddresses(
  tenantId: string,
  data: GetIpAddressesInput,
) {
  const { limit, startDate, endDate } = data;
  const { start, end } = getDateRange(startDate, endDate);

  const ipAddresses = await rateLimitRepo.aggregateRateLimitEvents<
    Array<{
      ipAddress: string;
      totalRequests: number;
      blockedRequests: number;
      blockRate: number;
      uniqueEndpoints: number;
      avgDuration: number | null;
      lastRequest: Date;
    }>
  >(
    {
      ipAddress: rateLimitEvents.ipAddress,
      totalRequests: sql<number>`count(*)`,
      blockedRequests: sql<number>`sum(case when is_blocked then 1 else 0 end)`,
      blockRate: sql<number>`round(avg(case when is_blocked then 1.0 else 0.0 end) * 100, 2)`,
      uniqueEndpoints: sql<number>`count(distinct endpoint)`,
      avgDuration: sql<number>`avg(request_duration_ms)`,
      lastRequest: sql<Date>`max(time)`,
    },
    { tenantId, time: { $gte: start, $lte: end } as const },
    {
      groupBy: [sql`${rateLimitEvents.ipAddress}`],
      orderBy: sql`count(*) desc`,
      limit: limit || 20,
    },
  );

  return { ipAddresses };
}
