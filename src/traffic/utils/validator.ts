import type { BunRequest } from "bun";
import { ZodObject, ZodError } from "zod";
import { createJsonResponse } from "../utils/response";
import type { ValidationSchema } from "../types";

export const validate = async (
  schema: ValidationSchema,
  req: BunRequest & {
    body?: any;
    query?: Record<string, any>;
    params?: Record<string, any>;
  },
): Promise<{ error?: Response }> => {
  try {
    const allErrors: Array<{
      field: string;
      message: string;
      validFields?: string[];
    }> = [];

    const isRequired = (zodSchema: any, key: string) => {
      return !zodSchema.shape[key].isOptional();
    };

    if (schema.body) {
      const validBodyFields = Object.keys(schema.body.shape);

      if (req.body && Object.keys(req.body).length > 0) {
        const bodyKeys = Object.keys(req.body);
        const invalidBodyKeys = bodyKeys.filter(
          (k) => !validBodyFields.includes(k),
        );
        if (invalidBodyKeys.length > 0) {
          allErrors.push({
            field: "body",
            message: `Invalid field(s) in body: '${invalidBodyKeys.join(
              "', '",
            )}'.`,
            validFields: validBodyFields,
          });
        }
      } else {
        const requiredFields = Object.keys(schema.body.shape).filter((key) =>
          isRequired(schema.body!, key),
        );

        if (requiredFields.length > 0) {
          allErrors.push({
            field: "body",
            message: `Missing required field(s): ${requiredFields.join(", ")}`,
            validFields: validBodyFields,
          });
        }
      }
    }

    // Query validation
    if (schema.query) {
      const validQueryFields = Object.keys(schema.query.shape);

      if (req.query && Object.keys(req.query).length > 0) {
        const queryKeys = Object.keys(req.query);
        const invalidQueryKeys = queryKeys.filter(
          (k) => !validQueryFields.includes(k),
        );

        if (invalidQueryKeys.length > 0) {
          allErrors.push({
            field: "query",
            message: `Invalid field(s) in query: '${invalidQueryKeys.join(
              "', '",
            )}'.`,
            validFields: validQueryFields,
          });
        }
      } else {
        const requiredFields = Object.keys(schema.query.shape).filter((key) =>
          isRequired(schema.query!, key),
        );

        if (requiredFields.length > 0) {
          allErrors.push({
            field: "query",
            message: `Missing required field(s): ${requiredFields.join(", ")}`,
            validFields: validQueryFields,
          });
        }
      }
    }

    if (allErrors.length > 0) {
      return {
        error: createJsonResponse(
          {
            status: "error",
            message: "Validation failed. Please check your inputs.",
            data: allErrors,
          },
          400,
          { "Content-Type": "application/json" },
        ),
      };
    }

    if (schema.body) {
      schema.body.parse(req.body);
    }

    if (schema.params) {
      schema.params.parse(req.params);
    }

    if (schema.query) {
      schema.query.parse(req.query);
    }

    if (schema.headers) {
      const headerObj: Record<string, any> = {};
      req.headers.forEach((value, key) => {
        headerObj[key.toLowerCase()] = value;
      });
      schema.headers.parse(headerObj);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((err) => ({
        field: err.path.join(".") || "unknown",
        message: err.message,
      }));

      return {
        error: createJsonResponse(
          {
            status: "error",
            message: "Validation failed. Please check your inputs.",
            data: errors,
          },
          400,
        ),
      };
    }
  }

  return {};
};

// export const validate = async (schema: ValidationSchema, req: any) => {
//   try {
//     if (schema.body && req.body) {
//       try {
//         req.body = await req.json();
//       } catch {
//         req.body = {};
//       }
//       req.body = schema.body.parse(req.body);
//     }
//     if (schema.query) req.query = schema.query.parse(req.query);
//     if (schema.params) req.params = schema.params.parse(req.params);

//     return {};
//   } catch (error) {
//     if (error instanceof ZodError) {
//       const formattedErrors = error.issues.map((err) => ({
//         field: err.path.join("."),
//         message: err.message,
//       }));
//       return {
//         error: createJsonResponse(
//           { status: "error", data: formattedErrors },
//           400,
//         ),
//       };
//     }
//     return { error: createJsonResponse({ error: "Server Error" }, 500) };
//   }
// };
