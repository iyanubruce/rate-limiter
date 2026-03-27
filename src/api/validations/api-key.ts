// schemas/apiKeys.ts
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

export const listKeysSchema = {
  querystring: {
    type: "object",
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
  response: {
    200: {
      type: "object",
      properties: {
        keys: { type: "array", items: { $ref: "apiKeyBaseSchema" } },
        pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
            hasMore: { type: "boolean" },
          },
        },
      },
    },
  },
};

export const createKeySchema = {
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
        },
      },
      expiresAt: { type: "string", format: "date-time" },
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
      required: ["apiKey", "keyId", "name", "keyPrefix", "createdAt"],
    },
    400: { $ref: "errors#/badRequest" },
    409: { $ref: "errors#/conflict" }, // Duplicate name
  },
};

export const updateKeySchema = {
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
    404: { $ref: "errors#/notFound" },
    403: { $ref: "errors#/forbidden" }, // Key belongs to another tenant
  },
};

export const deleteKeySchema = {
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
        keyId: { type: "integer" },
      },
    },
    404: { $ref: "errors#/notFound" },
    403: { $ref: "errors#/forbidden" },
  },
};
