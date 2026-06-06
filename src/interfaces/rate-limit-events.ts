export interface RateLimitLogLogPayload {
  time: Date;
  tenantId: string;
  apiKeyId: number;
  ipAddress: string;
  endpoint: string;
  method: string;
  userAgent: string;
  statusCode: number;
  requestDurationMs: number;
  responseSize: number;
  isBlocked: boolean;
  remainingQuota: number;
}
