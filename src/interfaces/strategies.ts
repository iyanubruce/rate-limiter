export const PLAN_STRATEGIES: Record<string, string[]> = {
  free: ["fixed_window"],
  pro: ["fixed_window", "token_bucket", "leaky_bucket"],
  enterprise: [
    "fixed_window",
    "token_bucket",
    "leaky_bucket",
    "sliding_window",
  ],
};

interface PlanLimit {
  requestsPerSecond: { min: number; max: number };
  burstSize: { min: number; max: number };
  windowMs: { min: number; max: number };
}

export const PLAN_LIMITS: Record<string, PlanLimit> = {
  free: {
    requestsPerSecond: { min: 1, max: 100 },
    burstSize: { min: 1, max: 500 },
    windowMs: { min: 1000, max: 3_600_000 },
  },
  pro: {
    requestsPerSecond: { min: 1, max: 1_000 },
    burstSize: { min: 1, max: 10_000 },
    windowMs: { min: 1000, max: 86_400_000 },
  },
  enterprise: {
    requestsPerSecond: { min: 1, max: 10_000 },
    burstSize: { min: 1, max: 100_000 },
    windowMs: { min: 1000, max: 86_400_000 },
  },
};
