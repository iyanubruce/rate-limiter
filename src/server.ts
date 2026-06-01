import Fastify from "fastify";
import type RedisClient from "./services/redis";
import type { DatabaseClient } from "./config/database";
import { registerPlugins } from "./plugins";
import { registerRoutes } from "./api/routes";
import { websocketHandlers } from "./websocket/native";
import config from "./config/env";
import logger from "./utils/logger";
import ErrorHandler from "./error/errorHandler";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "./websocket/native";

export function buildApp(redisClient: RedisClient, dbClient: DatabaseClient) {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    },
    trustProxy: true,
    disableRequestLogging: false,
    requestIdHeader: "x-request-id",
  });

  app.decorate("redis", redisClient);
  app.decorate("dbClient", dbClient);

  registerPlugins(app);
  registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    const isCustomError = error instanceof ErrorHandler;
    const baseError = error as Error;
    console.log("isCustomError", isCustomError);
    const statusCode = isCustomError ? error.getHttpCode() : 500;
    const message = isCustomError
      ? error.message
      : config.server.env === "development"
        ? (baseError.message ?? String(error))
        : "Internal server error";
    const errorName = isCustomError ? error.getName() : "internal error";
    const data = isCustomError ? error.getData() : null;

    logger.error("Request error", {
      error: errorName,
      message,
      statusCode,
      reqId: request.id,
      url: request.url,
      method: request.method,
    });

    reply.status(statusCode).send({
      error: true,
      name: errorName,
      message,
      statusCode,
      ...(data ? { data } : {}),
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

      // WebSocket endpoints
      if (url.pathname === "/ws" || url.pathname === "/ws/events" || url.pathname === "/ws/metrics") {
        if (server.upgrade(req)) {
          return; // upgrade successful → Bun calls websocket handlers
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      try {
        const headers = Object.fromEntries(req.headers);
        delete headers["content-length"];

        const payload = req.body
          ? Buffer.from(await req.arrayBuffer())
          : undefined;

        const injected = await app.inject({
          url: req.url,
          method: req.method as any,
          headers,
          query: Object.fromEntries(url.searchParams),
          payload,
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
        const url = new URL(ws.url);
        ws.data.pathname = url.pathname;
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
