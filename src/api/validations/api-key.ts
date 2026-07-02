import type { FastifySchema } from "fastify";

export const apiKeyBaseSchema = {
  properties: {
    keyId: { type: "integer" },
    name: { type: "string", minLength: 3, maxLength: 100 },
    description: { type: "string", maxLength: 255 },
    keyPrefix: { type: "string" },
    scopes: { type: "array", items: { type: "string" } },
    rateLimitOverride: {
      type: "object",
      properties: {
        requestsPerSecond: { type: "integer", minimum: 1, maximum: 10000 },
        burstSize: { type: "integer", minimum: 1 },
      },
    },
    expiresAt: { type: ["string", "null"], format: "date-time" },
    lastUsedAt: { type: ["string", "null"], format: "date-time" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    revokedAt: { type: ["string", "null"], format: "date-time" },
  },
};

export const listKeysSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
      offset: { type: "integer", default: 0, minimum: 0 },
      status: {
        type: "string",
        enum: ["active", "revoked", "all"],
        default: "active",
      },
      search: { type: "string", maxLength: 50 }, // Search by name/description
    },
  },
  // response: {
  //   200: {
  //     type: "object",
  //     required: ["keys", "pagination"],
  //     properties: {
  //       keys: {
  //         type: "array",
  //         items: {
  //           type: "object",
  //           properties: {
  //             ...apiKeyBaseSchema.properties,
  //           },
  //         },
  //       },
  //       pagination: {
  //         type: "object",
  //         required: ["total", "limit", "offset", "hasMore"],
  //         properties: {
  //           total: { type: "integer" },
  //           limit: { type: "integer" },
  //           offset: { type: "integer" },
  //           hasMore: { type: "boolean" },
  //         },
  //       },
  //     },
  //   },
  // },
};

export const createKeySchema: FastifySchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 100 },
      description: { type: "string", maxLength: 255 },
      scopes: {
        type: "array",
        items: { type: "string", enum: ["read", "write", "admin"] },
        default: ["read"],
      },
      rateLimitOverride: {
        type: "object",
        properties: {
          requestsPerSecond: { type: "integer", minimum: 1, maximum: 10000 },
          burstSize: { type: "integer", minimum: 1 },
          windowMs: { type: "integer", minimum: 1000 }, // Custom time window in ms
          strategy: {
            type: "string",
            enum: ["token-bucket", "sliding-window", "fixed-window"],
          },
          endpoints: {
            type: "object",
            additionalProperties: {
              type: "object",
              properties: {
                requestsPerSecond: { type: "integer", minimum: 1 },
                burstSize: { type: "integer", minimum: 1 },
              },
              required: ["requestsPerSecond"],
            },
          },
        },
      },
      priority: { type: "integer", minimum: 0 }, // Evaluation order for multiple overrides
      expiresAt: { type: "string", format: "date-time" },
      meta: { type: "object", additionalProperties: true }, // For extensibility
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "⚠️ Store this securely - it won't be shown again",
        },
        ...apiKeyBaseSchema.properties,
      },
      required: ["apiKey", "keyId", "name", "createdAt"],
    },
    400: { $ref: "errors#/$defs/badRequest" },
    409: { $ref: "errors#/$defs/conflict" }, // Duplicate name
  },
};

export const updateKeySchema: FastifySchema = {
  params: {
    type: "object",
    required: ["keyId"],
    properties: { keyId: { type: "integer" } },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 100 },
      description: { type: "string", maxLength: 255 },
      scopes: {
        type: "array",
        items: { type: "string", enum: ["read", "write", "admin"] },
      },
      rateLimitOverride: {
        type: ["object", "null"],
        properties: {
          requestsPerSecond: { type: "integer", minimum: 1, maximum: 10000 },
          burstSize: { type: "integer", minimum: 1 },
          strategy: {
            type: "string",
            enum: ["token-bucket", "sliding-window", "fixed-window"],
          },
        },
      },
    },
    anyOf: [
      { required: ["name"] },
      { required: ["description"] },
      { required: ["scopes"] },
      { required: ["rateLimitOverride"] },
    ],
  },
  response: {
    200: { type: "object", properties: { ...apiKeyBaseSchema.properties } },
    404: { $ref: "errors#/$defs/notFound" },
    403: { $ref: "errors#/$defs/forbidden" }, // Key belongs to another tenant
  },
};

export const deleteKeySchema: FastifySchema = {
  params: {
    type: "object",
    required: ["keyId"],
    properties: { keyId: { type: "integer" } },
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
    403: { $ref: "errors#/$defs/forbidden" },
  },
};

export const getKeySchema: FastifySchema = {
  params: {
    type: "object",
    required: ["keyId"],
    properties: { keyId: { type: "integer" } },
  },
};
