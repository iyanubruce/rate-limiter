import { createCheckHandler } from "../handlers/checkRateLimit/controller";
import type { RouteHandler } from "../types";
import { checkRateLimitSchema } from "../handlers/checkRateLimit/validator";

export const createRoutes = (): RouteHandler[] => {
  return [
    {
      method: "POST",
      pathname: "/api/v1/check",
      handler: createCheckHandler(),
      validator: checkRateLimitSchema,
    },
  ];
};
