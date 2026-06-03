// utils/type-guards.ts
export function sanitizeSearchInput(
  search: string | undefined,
): string | undefined {
  if (!search) return undefined;
  // Prevent SQL injection via LIKE wildcards
  return search.replace(/[%_\\]/g, "\\$&").slice(0, 50);
}

export function validatePagination(
  limit: number,
  page: number,
): { limit: number; page: number } {
  return {
    limit: Math.min(Math.max(limit, 1), 100), // 1-100
    page: Math.max(page, 1), // Min 1
  };
}
