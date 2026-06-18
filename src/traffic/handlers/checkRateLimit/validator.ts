import { z } from "zod";
export const checkRateLimitBody = z
  .object({
    tenantId: z.string().min(1, "Tenant ID is required"),
    identifier: z.string().min(1, "Identifier is required"),
    endpoint: z.string().optional(),
    strategy: z.string().optional(),
    method: z.string().optional(),
    weight: z.number().int().positive().default(1),
  })
  .strict();

export const checkRateLimitSchema = {
  headers: z.object({
    "x-api-key": z.string().min(1, "API key is required"),
  }),
  body: checkRateLimitBody,
};
