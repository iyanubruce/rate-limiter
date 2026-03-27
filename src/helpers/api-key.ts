import type {
  ListKeysInterface,
  ListKeysWhereClause,
} from "../interfaces/api-key";
import { isNull, isNotNull, ilike, and, type SQL } from "drizzle-orm";
import { apiKeys } from "../database/models";
import { sanitizeSearchInput, validatePagination } from "../utils/type-guards";

export const parseWhereQueryForListApiKeys = (
  data: ListKeysInterface,
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
