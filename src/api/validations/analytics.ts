import type { FastifySchema } from "fastify";

export const analyticsOverviewSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};
