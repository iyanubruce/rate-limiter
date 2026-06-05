import logger from "./utils/logger";
import { createRoutes } from "./traffic/routes";
import {
  createJsonResponse,
  createErrorResponse,
} from "./traffic/utils/response";
import type { BunRequest } from "bun";
import { validate } from "./traffic/utils/validator";

export const createTrafficServer = () => {
  logger.info("🚀 Starting high-speed Bun Traffic Microservice...");

  const routes = createRoutes();

  return {
    port: Number(process.env.TRAFFIC_PORT) || 3001,
    async fetch(req: BunRequest) {
      const url = new URL(req.url);
      const queryObj: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        queryObj[key] = value;
      });

      const route = routes.find(
        (r) => r.method === req.method && r.pathname === url.pathname,
      );

      if (route) {
        try {
          let body: any;
          const contentType = req.headers.get("content-type");
          if (
            req.method !== "GET" &&
            req.method !== "HEAD" &&
            contentType?.includes("application/json")
          ) {
            try {
              body = await req.json();
            } catch {
              body = null;
            }
          }

          Object.defineProperty(req, "body", {
            value: body,
            writable: true,
            configurable: true,
            enumerable: true,
          });

          (req as any).query = queryObj;
          (req as any).params = {};

          if (route.validator) {
            const validationResult = await validate(route.validator, req);

            if (validationResult.error) {
              return validationResult.error;
            }
          }
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
