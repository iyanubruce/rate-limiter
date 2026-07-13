import type { FastifySchema } from "fastify";

export const aiAnalyticsSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["question"],
    properties: {
      question: { type: "string", minLength: 1, maxLength: 500 },
    },
  },
};
