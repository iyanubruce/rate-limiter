export const checkRateLimitSchema = {
  querystring: {
    type: "object",
    required: ["key", "identifier"],
    properties: {
      key: { type: "string", description: "Rate limit key (e.g., user:123)" },
      identifier: {
        type: "string",
        description: "Unique identifier (IP, user ID, API key)",
      },
      strategy: {
        type: "string",
        enum: ["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"],
        default: "token_bucket",
      },
      limit: { type: "integer", minimum: 1, default: 100 },
      windowSeconds: { type: "integer", minimum: 1, default: 60 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        allowed: { type: "boolean" },
        remaining: { type: "integer" },
        resetAt: { type: "integer" },
        limit: { type: "integer" },
        strategy: { type: "string" },
      },
    },
    429: {
      type: "object",
      properties: {
        error: { type: "boolean" },
        message: { type: "string" },
        statusCode: { type: "integer" },
        retryAfter: { type: "integer" },
      },
    },
  },
};

export const createRuleSchema = {
  body: {
    type: "object",
    required: ["name", "strategy", "limit", "windowMs"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 100 },
      strategy: {
        type: "string",
        enum: ["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"],
      },
      limit: { type: "integer", minimum: 1, maximum: 1000000 },
      windowMs: { type: "integer", minimum: 1000, maximum: 86400000 },
      endpoint: { type: "string", maxLength: 500 },
      ipWhitelist: { type: "string", maxLength: 1000 },
      isActive: { type: "boolean", default: true },
      burstAllowance: { type: "integer", minimum: 0 },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        strategy: { type: "string" },
        limit: { type: "integer" },
        windowMs: { type: "integer" },
        endpoint: { type: "string" },
        isActive: { type: "boolean" },
        burstAllowance: { type: "integer" },
        createdAt: { type: "string" },
      },
    },
  },
};

export const listRulesSchema = {
  querystring: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      page: { type: "integer", minimum: 1, default: 1 },
      status: { type: "string", enum: ["active", "inactive", "all"] },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
              strategy: { type: "string" },
              limit: { type: "integer" },
              windowMs: { type: "integer" },
              endpoint: { type: "string" },
              isActive: { type: "boolean" },
              createdAt: { type: "string" },
            },
          },
        },
        pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            limit: { type: "integer" },
            page: { type: "integer" },
            hasMore: { type: "boolean" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
  },
};

export const updateRuleSchema = {
  params: {
    type: "object",
    required: ["ruleId"],
    properties: { ruleId: { type: "integer" } },
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 100 },
      strategy: {
        type: "string",
        enum: ["token_bucket", "sliding_window", "leaky_bucket", "fixed_window"],
      },
      limit: { type: "integer", minimum: 1, maximum: 1000000 },
      windowMs: { type: "integer", minimum: 1000, maximum: 86400000 },
      endpoint: { type: "string", maxLength: 500 },
      ipWhitelist: { type: "string", maxLength: 1000 },
      isActive: { type: "boolean" },
      burstAllowance: { type: "integer", minimum: 0 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        strategy: { type: "string" },
        limit: { type: "integer" },
        windowMs: { type: "integer" },
        endpoint: { type: "string" },
        isActive: { type: "boolean" },
        burstAllowance: { type: "integer" },
        updatedAt: { type: "string" },
      },
    },
  },
};

export const deleteRuleSchema = {
  params: {
    type: "object",
    required: ["ruleId"],
    properties: { ruleId: { type: "integer" } },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        ruleId: { type: "integer" },
      },
    },
  },
};

export const getQuotaStatusSchema = {
  querystring: {
    type: "object",
    required: ["key"],
    properties: {
      key: { type: "string" },
      strategy: {
        type: "string",
        enum: ["token_bucket", "sliding_window"],
        default: "token_bucket",
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        key: { type: "string" },
        remaining: { type: "integer" },
        total: { type: "integer" },
        strategy: { type: "string" },
      },
    },
  },
};

export const checkRateLimitPostSchema = {
  body: {
    type: "object",
    required: ["identifier"],
    properties: {
      identifier: { type: "string", description: "Unique identifier (IP, user ID, API key)" },
      apiKey: { type: "string", description: "API key for authentication" },
      endpoint: { type: "string", default: "/" },
      method: { type: "string", default: "GET" },
      limit: { type: "integer", minimum: 1 },
      windowSeconds: { type: "integer", minimum: 1 },
      strategy: {
        type: "string",
        enum: ["token_bucket", "sliding_window", "leaky_bucket"],
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        allowed: { type: "boolean" },
        remaining: { type: "integer" },
        resetAt: { type: "integer" },
        limit: { type: "integer" },
        strategy: { type: "string" },
      },
    },
    429: {
      type: "object",
      properties: {
        allowed: { type: "boolean" },
        remaining: { type: "integer" },
        resetAt: { type: "integer" },
        limit: { type: "integer" },
        strategy: { type: "string" },
        retryAfter: { type: "integer" },
        blockedReason: { type: "string" },
      },
    },
  },
};

export const batchCheckSchema = {
  body: {
    type: "object",
    required: ["requests"],
    properties: {
      requests: {
        type: "array",
        items: {
          type: "object",
          required: ["identifier"],
          properties: {
            identifier: { type: "string" },
            limit: { type: "integer", minimum: 1 },
            windowSeconds: { type: "integer", minimum: 1 },
            strategy: {
              type: "string",
              enum: ["token_bucket", "sliding_window", "leaky_bucket"],
            },
          },
        },
        maxItems: 100,
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              identifier: { type: "string" },
              allowed: { type: "boolean" },
              remaining: { type: "integer" },
              resetAt: { type: "integer" },
              limit: { type: "integer" },
              strategy: { type: "string" },
            },
          },
        },
      },
    },
  },
};
