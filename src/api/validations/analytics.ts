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

export const analyticsEventsSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      offset: { type: "integer", minimum: 0, default: 0 },
      isBlocked: { type: "boolean" },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};

export const analyticsTimeseriesSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      interval: {
        type: "string",
        enum: ["1m", "5m", "1h", "1d"],
        default: "1h",
      },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};

export const analyticsTopBlockedSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};

export const analyticsPatternsSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};

export const analyticsEndpointsSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};

export const analyticsStatusCodesSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};

export const analyticsIpAddressesSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
    },
  },
};
