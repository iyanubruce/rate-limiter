import type { FastifySchema } from "fastify";

export const upgradeTenantSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["plan"],
    properties: {
      plan: {
        type: "string",
        enum: ["free", "pro", "enterprise"],
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        url: { type: "string" },
      },
      required: ["sessionId", "url"],
    },
  },
};
