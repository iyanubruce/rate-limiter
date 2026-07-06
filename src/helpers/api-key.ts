import type {
  ListKeysInterface,
  ListKeysWhereClause,
} from "../interfaces/api-key";
import { isNull, isNotNull, ilike, and, type SQL, eq } from "drizzle-orm";
import { apiKeys } from "../database/models";
import { sanitizeSearchInput, validatePagination } from "../utils/type-guards";
import { PLAN_STRATEGIES, PLAN_LIMITS } from "../interfaces/strategies";
import { BadRequestError } from "../error";
import type { RateLimitOverride } from "../database/models/api-keys";

export const parseWhereQueryForListApiKeys = (
  data: ListKeysInterface,
  userId: number,
): ListKeysWhereClause => {
  const { limit, page, status, search } = data;

  const sanitizedSearch = sanitizeSearchInput(search);
  const { limit: validatedLimit, page: validatedPage } = validatePagination(
    limit || 20,
    page || 1,
  );

  const conditions: SQL[] = [];

  if (status === "active") {
    conditions.push(isNull(apiKeys.revokedAt));
  } else if (status === "revoked") {
    conditions.push(isNotNull(apiKeys.revokedAt));
  }

  if (search) {
    conditions.push(ilike(apiKeys.name, `%${sanitizedSearch}%`));
  }
  conditions.push(eq(apiKeys.userId, userId));

  const query: SQL | undefined =
    conditions.length > 0 ? and(...conditions) : undefined;

  const where = {
    query,
    limit: validatedLimit,
    offset: (validatedPage - 1) * validatedLimit,
    page: validatedPage,
  };

  return where;
};

export function validateRateLimitOverride(
  rateLimitOverride: Partial<RateLimitOverride> | undefined | null,
  plan: string,
) {
  if (!rateLimitOverride) return;

  if (rateLimitOverride.strategy) {
    const normalized = rateLimitOverride.strategy.replace(/-/g, "_");
    const allowed = PLAN_STRATEGIES[plan] ?? [];
    if (!allowed.includes(normalized)) {
      throw new BadRequestError(
        `Strategy "${rateLimitOverride.strategy}" is not allowed on the ${plan} plan. Allowed strategies: ${allowed.join(", ")}`,
      );
    }
  }

  const limits = PLAN_LIMITS[plan]!;

  if (
    rateLimitOverride.requestsPerSecond !== undefined &&
    (rateLimitOverride.requestsPerSecond < limits.requestsPerSecond.min ||
      rateLimitOverride.requestsPerSecond > limits.requestsPerSecond.max)
  ) {
    throw new BadRequestError(
      `requestsPerSecond must be between ${limits.requestsPerSecond.min} and ${limits.requestsPerSecond.max} on the ${plan} plan`,
    );
  }

  if (
    rateLimitOverride.burstSize !== undefined &&
    (rateLimitOverride.burstSize < limits.burstSize.min ||
      rateLimitOverride.burstSize > limits.burstSize.max)
  ) {
    throw new BadRequestError(
      `burstSize must be between ${limits.burstSize.min} and ${limits.burstSize.max} on the ${plan} plan`,
    );
  }

  if (
    rateLimitOverride.windowMs !== undefined &&
    (rateLimitOverride.windowMs < limits.windowMs.min ||
      rateLimitOverride.windowMs > limits.windowMs.max)
  ) {
    throw new BadRequestError(
      `windowMs must be between ${limits.windowMs.min} and ${limits.windowMs.max} on the ${plan} plan`,
    );
  }
}
