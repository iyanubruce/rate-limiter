import type { FastifySchema } from "fastify";

export const registerSchema: FastifySchema = {
  body: {
    type: "object",
    required: [
      "email",
      "password",
      "organizationEmail",
      "organizationName",
      "firstName",
      "lastName",
    ],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 8 },
      organizationEmail: { type: "string" },
      organizationName: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
    },
  },
};

export const googleAuthSchema: FastifySchema = {
  body: {
    type: "object",
    required: [
      "googleId",
      "email",
      "organizationEmail",
      "organizationName",
      "firstName",
      "lastName",
    ],
    properties: {
      googleId: { type: "string" },
      email: { type: "string", format: "email" },
      organizationEmail: { type: "string" },
      organizationName: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
    },
  },
};

export const loginSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string" },
    },
  },
};

export const refreshTokenSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["refreshToken"],
    properties: {
      refreshToken: { type: "string" },
    },
  },
};
