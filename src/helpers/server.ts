import RedisClient from "../services/redis";
import config from "../config/env";
import { registerRoutes } from "../api/routes";
import type { DatabaseClient } from "../config/database";
import ErrorHandler from "../error/errorHandler";
import { registerPlugins } from "../plugins";
import logger from "../utils/logger";
import Fastify from "fastify";
export default function buildApp(
  redisClient: RedisClient,
  dbClient: DatabaseClient,
) {
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
