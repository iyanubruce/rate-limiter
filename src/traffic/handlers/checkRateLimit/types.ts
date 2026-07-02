import { checkRateLimitBody } from "./validator";
import { z } from "zod";
export interface KeyMetadata {
  id: number;
  userId: number;
  scopes: string[];
  tenantId: string;
  plan: string;
  strategy: string;
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

export type CheckRateLimitInput = z.infer<typeof checkRateLimitBody>;
