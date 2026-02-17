import Fastify from "fastify";
import type { HTTPMethods } from "fastify";
import type { RedisClient } from "./services/redis";
import type { DatabaseClient } from "./services/database";
import { registerPlugins } from "./plugins";
import { registerRoutes } from "./routes";
import { websocketHandlers } from "./websocket/native";
import config from "./config/env";
import logger from "./utils/logger";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "./websocket/native";

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisClient;
    db: DatabaseClient;
  }
}

export function buildApp(redisClient: RedisClient, dbClient: DatabaseClient) {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    disableRequestLogging: true,
    requestIdHeader: "x-request-id",
  });

  app.decorate("redis", redisClient);
  app.decorate("db", dbClient);

  registerPlugins(app);
  registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    logger.error("Request error", {
      error,
      reqId: request.id,
      url: request.url,
      method: request.method,
    });

    const statusCode =
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const message =
      config.server.env === "development"
        ? error instanceof Error
          ? error.message
          : String(error)
        : "Internal server error";

    reply.status(statusCode).send({
      error: true,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: true,
      message: "Route not found",
      statusCode: 404,
      path: request.url,
    });
  });

  return app;
}

// Optional: export a ready-to-use server creator
export function createBunServer(
  redisClient: RedisClient,
  dbClient: DatabaseClient,
) {
  const app = buildApp(redisClient, dbClient);

  return Bun.serve({
    port: config.server.port ?? 3000,
    hostname: "0.0.0.0",

    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        if (server.upgrade(req)) {
          return; // upgrade successful → Bun calls websocket handlers
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      try {
        const injected = await app.inject({
          url: req.url, // full URL is fine
          method: req.method as any,
          headers: Object.fromEntries(req.headers),
          query: Object.fromEntries(url.searchParams),
          payload: req.body ? await req.arrayBuffer() : undefined, // better than .text() for binary
        });

        return new Response(injected.payload, {
          status: injected.statusCode,
          headers: injected.headers as Record<string, string>,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err : String(err);
        logger.error(
          `Fastify handler crashed: \n ${JSON.stringify(errorMsg, null, 2)}`,
        );
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    },

    websocket: {
      open(ws) {
        websocketHandlers.onOpen(
          ws as unknown as ServerWebSocket<WebSocketData>,
          redisClient,
          dbClient,
        );
      },
      message(ws, msg) {
        websocketHandlers.onMessage(
          ws as unknown as ServerWebSocket<WebSocketData>,
          msg,
          redisClient,
          dbClient,
        );
      },
      close(ws, code, reason) {
        websocketHandlers.onClose(
          ws as unknown as ServerWebSocket<WebSocketData>,
          code,
          reason,
        );
      },
    },
  });
}
