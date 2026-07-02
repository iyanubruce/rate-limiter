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
