import { Redis } from "ioredis";
import config from "./config/env";
import logger from "./utils/logger";
import { createRoutes } from "./traffic/routes";
import {
  createJsonResponse,
  createErrorResponse,
} from "./traffic/utils/response";
import type { BunRequest } from "bun";

export const createTrafficServer = () => {
  logger.info("🚀 Starting high-speed Bun Traffic Microservice...");

  const routes = createRoutes();

  return {
    port: Number(process.env.TRAFFIC_PORT) || 3001,
    async fetch(req: BunRequest) {
      const url = new URL(req.url);

      const route = routes.find(
        (r) => r.method === req.method && r.pathname === url.pathname,
      );

      if (route) {
        try {
          return await route.handler(req);
        } catch (err) {
          logger.error("Route handler error:", err);
          return createErrorResponse("Internal Server Error", 500);
        }
      }

      return createJsonResponse({ error: "Not Found" }, 404);
    },
  };
};
