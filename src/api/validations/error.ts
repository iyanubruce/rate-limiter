// validations/errors.ts
export const errorSchemas = {
  $id: "errors",
  type: "object",
  $defs: {
    badRequest: {
      type: "object",
      properties: {
        statusCode: { type: "integer", example: 400 },
        error: { type: "string", example: "Bad Request" },
        message: { type: "string" },
      },
      required: ["statusCode", "error", "message"],
    },
    conflict: {
      type: "object",
      properties: {
        statusCode: { type: "integer", example: 409 },
        error: { type: "string", example: "Conflict" },
        message: { type: "string" },
      },
      required: ["statusCode", "error", "message"],
    },
    notFound: {
      type: "object",
      properties: {
        statusCode: { type: "integer", example: 404 },
        error: { type: "string", example: "Not Found" },
        message: { type: "string" },
      },
      required: ["statusCode", "error", "message"],
    },
    forbidden: {
      type: "object",
      properties: {
        statusCode: { type: "integer", example: 403 },
        error: { type: "string", example: "Forbidden" },
        message: { type: "string" },
      },
      required: ["statusCode", "error", "message"],
    },
  },
};
