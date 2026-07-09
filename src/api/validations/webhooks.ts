import type { FastifySchema } from "fastify";

export const createWebhookSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["url", "events"],
    additionalProperties: false,
    properties: {
      url: { type: "string", format: "uri", minLength: 1, maxLength: 500 },
      secret: { type: "string", maxLength: 255 },
      events: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "quota_warning",
            "rate_limit_exceeded",
            "api_key_expiring",
            "error_rate_spike",
          ],
        },
        minItems: 1,
      },
      isActive: { type: "boolean", default: true },
      headers: { type: "object", additionalProperties: { type: "string" } },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        id: { type: "integer" },
        url: { type: "string" },
        events: { type: "array", items: { type: "string" } },
        isActive: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    400: { $ref: "errors#/$defs/badRequest" },
  },
};

export const updateWebhookSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["webhookId"],
    properties: { webhookId: { type: "integer" } },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      url: { type: "string", format: "uri", maxLength: 500 },
      secret: { type: "string", maxLength: 255 },
      events: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "quota_warning",
            "rate_limit_exceeded",
            "api_key_expiring",
            "error_rate_spike",
          ],
        },
        minItems: 1,
      },
      isActive: { type: "boolean" },
      headers: { type: "object", additionalProperties: { type: "string" } },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "integer" },
        url: { type: "string" },
        events: { type: "array", items: { type: "string" } },
        isActive: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
    404: { $ref: "errors#/$defs/notFound" },
    400: { $ref: "errors#/$defs/badRequest" },
  },
};

export const listWebhooksSchema: FastifySchema = {};

export const getWebhookSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["webhookId"],
    properties: { webhookId: { type: "integer" } },
  },
  response: {
    404: { $ref: "errors#/$defs/notFound" },
  },
};

export const deleteWebhookSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["webhookId"],
    properties: { webhookId: { type: "integer" } },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
    },
    404: { $ref: "errors#/$defs/notFound" },
  },
};
