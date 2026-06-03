export interface KeyMetadata {
  userId: number;
  scopes: string[];
  rateLimitOverride?: {
    requestsPerSecond?: number;
    burstSize?: number;
    windowMs?: number;
    strategy?: string;
    endpoints?: Record<
      string,
      { requestsPerSecond: number; burstSize?: number }
    >;
  };
  expiresAt?: string | null;
  revokedAt: null | string;
}
