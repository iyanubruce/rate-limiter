export const seconds = (n: number) => n * 1000;
export const minutes = (n: number) => n * 60 * 1000;
export const hours = (n: number) => n * 60 * 60 * 1000;

//unused ratelimit config type and type guard
// export type RateLimitConfig = {
//   max: number;
//   timeWindow: number;
// };

// export const rateLimitRule = (config: RateLimitConfig): RateLimitConfig => config;
