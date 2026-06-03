import { Redis } from "ioredis";
import { createCheckHandler } from "../handlers/check";
import type { RouteHandler } from "../types";

export const createRoutes = (): RouteHandler[] => {
  return [
    {
      method: "POST",
      pathname: "/api/v1/check",
      handler: createCheckHandler(),
    },
  ];
};
