import type { SQL } from "drizzle-orm";

export interface ListKeysInterface {
  limit?: number;
  page?: number;
  status?: string;
  search?: string;
}

export interface ListKeysWhereClause {
  query?: SQL;
  limit: number;
  offset: number;
  page: number;
}

export interface CreateKeyInput {
  tenantId?: number | null;
  keyPrefix: string;
  name: string;
  description?: string;
  scopes?: string[];
  rateLimitOverride?: any;
  ipAllowlist?: string[];
  expiresAt?: string;
  metadata?: any;
}
