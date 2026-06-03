export const healthHandler = async (request: any, reply: any) => {
  return {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
};

export const detailedHealthHandler = async (request: any, reply: any) => {
  const startMem = process.memoryUsage();
  const startTime = Date.now();

  const redisStatus = await checkRedisHealth(request.server.redis);
  const dbStatus = await checkDatabaseHealth();
  const memUsage = {
    rss: Math.round(startMem.rss / 1024 / 1024),
    heapTotal: Math.round(startMem.heapTotal / 1024 / 1024),
    heapUsed: Math.round(startMem.heapUsed / 1024 / 1024),
    external: Math.round(startMem.external / 1024 / 1024),
  };

  const isHealthy = redisStatus.connected && dbStatus.connected;
  const latency = Date.now() - startTime;

  return reply.code(isHealthy ? 200 : 503).send({
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    latencyMs: latency,
    components: {
      redis: redisStatus,
      database: dbStatus,
    },
    memory: memUsage,
    cpu: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  });
};

async function checkRedisHealth(redis: any) {
  try {
    const start = Date.now();
    await redis.client.ping();
    return {
      connected: true,
      latencyMs: Date.now() - start,
      host: redis.client.options?.host || "unknown",
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: 0,
      error: "Redis connection failed",
    };
  }
}

async function checkDatabaseHealth() {
  try {
    const { db } = await import("../../config/database");
    const { sql } = await import("drizzle-orm");
    const start = Date.now();
    await db().execute(sql`SELECT 1`);
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: 0,
      error: "Database connection failed",
    };
  }
}
