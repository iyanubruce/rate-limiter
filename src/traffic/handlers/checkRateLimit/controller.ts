import { createJsonResponse, createErrorResponse } from "../../utils/response";
import logger from "../../../utils/logger";
import type { CheckRateLimitInput } from "./types";
import RateLimitService from "../../../services/rate-limit-service";

const rateLimitService = new RateLimitService();

export const createCheckHandler = () => {
  return async (req: any): Promise<Response> => {
    try {
      const apiKey = req.headers.get("x-api-key")!;
      const data: CheckRateLimitInput = req.body;
      const { tenantId, identifier, endpoint, method, weight } = data;

      const result = await rateLimitService.checkRateLimit({
        tenantId,
        identifier,
        apiKey,
        endpoint,
        method,
        weight,
        userAgent: req.headers.get("user-agent") || "UNKNOWN",
      });

      if (
        result.blockedReason === "api_key_mismatch" ||
        result.blockedReason === "api_key_not_found_or_revoked"
      ) {
        return createErrorResponse("API key not found or revoked", 401);
      }

      if (!result.allowed) {
        return createJsonResponse(result, 429, {
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(result.retryAfter ?? 1),
        });
      }

      return createJsonResponse(result, 200, {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      });
    } catch (err) {
      logger.error("Traffic Handler Error: ", err);
      return createErrorResponse("Internal Server Error", 500);
    }
  };
};
