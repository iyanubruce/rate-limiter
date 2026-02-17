import logger from "../utils/logger";
import Redis, {
  type Redis as RedisClientType,
  type RedisOptions,
} from "ioredis";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class RedisClient {
  public client: RedisClientType;
  private config: RedisConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;

  constructor(config: RedisConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
      retryStrategy: (retries) => {
        if (retries >= (this.config.maxRetries || 3)) {
          logger.error("Redis max reconnection attempts reached");
          return null; // Stop retrying
        }

        const delay = Math.min(retries * 100, this.config.retryDelay || 1000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
      reconnectOnError: (err) => {
        logger.error("Redis connection error:", err.message);
        return true; // Attempt reconnect
      },
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    };

    this.client = new Redis(options);
    this.setupEventHandlers();
    this.defineCommands();
  }

  private setupEventHandlers() {
    this.client.on("connect", () => {
      logger.info("Redis client connecting...");
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info("Redis client ready");
    });

    this.client.on("error", (error) => {
      logger.error("Redis client error:", error);
    });

    this.client.on("reconnecting", () => {
      this.reconnectAttempts++;
      logger.warn(
        `Redis client reconnecting (attempt ${this.reconnectAttempts})`,
      );
    });

    this.client.on("close", () => {
      this.isConnected = false;
      logger.info("Redis connection closed");
    });

    this.client.on("end", () => {
      this.isConnected = false;
      logger.info("Redis connection ended");
    });
  }

  private defineCommands() {
    // Define the rateLimit Lua script as a custom command
    (this.client as any).defineCommand("rateLimit", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local timeWindow = tonumber(ARGV[1])
        local max = tonumber(ARGV[2])
        local continueExceeding = ARGV[3] == 'true'
        local exponentialBackoff = ARGV[4] == 'true'
        local MAX_SAFE_INTEGER = (2^53) - 1

        local current = redis.call('INCR', key)

        if current == 1 or (continueExceeding and current > max) then
          redis.call('PEXPIRE', key, timeWindow)
        elseif exponentialBackoff and current > max then
          local backoffExponent = current - max - 1
          timeWindow = math.min(timeWindow * (2 ^ backoffExponent), MAX_SAFE_INTEGER)
          redis.call('PEXPIRE', key, timeWindow)
        else
          timeWindow = redis.call('PTTL', key)
        end

        return {current, timeWindow}
      `,
    });
  }

  async connect(): Promise<void> {
    try {
      // ioredis connects automatically, but we can wait for ready state
      await new Promise<void>((resolve, reject) => {
        if (this.isConnected) {
          resolve();
          return;
        }

        const onReady = () => {
          this.client.off("ready", onReady);
          this.client.off("error", onError);
          resolve();
        };

        const onError = (err: Error) => {
          this.client.off("ready", onReady);
          this.client.off("error", onError);
          reject(err);
        };

        this.client.once("ready", onReady);
        this.client.once("error", onError);
      });
      logger.info("✓ Redis connected successfully");
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info("✓ Redis disconnected successfully");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({
        event: "redis_disconnect_error",
        error: errorMsg,
      });
      throw error;
    }
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  isReady(): boolean {
    return this.isConnected && this.client.status === "ready";
  }

  // Rate limiting operations using Lua scripts
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    strategy:
      | "token_bucket"
      | "sliding_window"
      | "leaky_bucket" = "token_bucket",
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    switch (strategy) {
      case "token_bucket":
        return this.tokenBucket(key, limit, windowSeconds);
      case "sliding_window":
        return this.slidingWindow(key, limit, windowSeconds);
      case "leaky_bucket":
        return this.leakyBucket(key, limit, windowSeconds);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  // Token Bucket algorithm using Lua script
  private async tokenBucket(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const resetAt = now + windowSeconds * 1000;

    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1])
      local last_refill = tonumber(bucket[2])
      
      if tokens == nil then
        tokens = limit
        last_refill = now
      else
        local time_passed = now - last_refill
        local tokens_to_add = math.floor(time_passed / 1000) * (limit / window)
        tokens = math.min(limit, tokens + tokens_to_add)
        last_refill = now
      end
      
      local allowed = 0
      if tokens >= 1 then
        tokens = tokens - 1
        allowed = 1
      end
      
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
      redis.call('EXPIRE', key, window * 2)
      
      return {allowed, math.floor(tokens), last_refill + (window * 1000)}
    `;

    const result = (await this.client.eval(
      script,
      1,
      key,
      limit.toString(),
      windowSeconds.toString(),
      now.toString(),
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      resetAt: result[2] ?? 0,
    };
  }

  // Sliding Window algorithm using Lua script
  private async slidingWindow(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local window_ms = tonumber(ARGV[4])
      
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      local current = redis.call('ZCARD', key)
      
      local allowed = 0
      if current < limit then
        redis.call('ZADD', key, now, now)
        allowed = 1
        current = current + 1
      end
      
      redis.call('EXPIRE', key, math.ceil(window_ms / 1000))
      
      local remaining = math.max(0, limit - current)
      local reset_at = now + window_ms
      
      return {allowed, remaining, reset_at}
    `;

    const result = (await this.client.eval(
      script,
      1,
      key,
      limit.toString(),
      windowStart.toString(),
      now.toString(),
      windowMs.toString(),
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      resetAt: result[2] ?? now + windowMs,
    };
  }

  // Leaky Bucket algorithm using Lua script
  private async leakyBucket(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const leakRate = limit / windowSeconds;

    const script = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local leak_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      local bucket = redis.call('HMGET', key, 'water', 'last_leak')
      local water = tonumber(bucket[1]) or 0
      local last_leak = tonumber(bucket[2]) or now
      
      local time_passed = (now - last_leak) / 1000
      local leaked = time_passed * leak_rate
      water = math.max(0, water - leaked)
      
      local allowed = 0
      if water < capacity then
        water = water + 1
        allowed = 1
      end
      
      redis.call('HMSET', key, 'water', water, 'last_leak', now)
      redis.call('EXPIRE', key, capacity / leak_rate)
      
      local remaining = math.floor(capacity - water)
      local reset_at = now + ((water / leak_rate) * 1000)
      
      return {allowed, remaining, reset_at}
    `;

    const result = (await this.client.eval(
      script,
      1,
      key,
      limit.toString(),
      leakRate.toString(),
      now.toString(),
    )) as [number, number, number];

    if (!result) {
      throw new Error("No result");
    }

    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      resetAt: result[2] ?? 0,
    };
  }

  // Use the defined custom command
  async fixedWindowRateLimit(
    key: string,
    timeWindow: number,
    max: number,
    continueExceeding: boolean,
    exponentialBackoff: boolean,
  ): Promise<{ current: number; timeWindow: number }> {
    const result = (await (this.client as any).rateLimit(
      key,
      timeWindow.toString(),
      max.toString(),
      continueExceeding.toString(),
      exponentialBackoff.toString(),
    )) as [number, number];

    return {
      current: result[0] ?? 0,
      timeWindow: result[1] ?? 0,
    };
  }

  // Get current quota status
  async getQuotaStatus(
    key: string,
    strategy: string,
  ): Promise<{
    remaining: number;
    total: number;
  }> {
    try {
      if (strategy === "sliding_window") {
        const count = await this.client.zcard(key);
        return { remaining: count, total: count };
      } else {
        const data = await this.client.hgetall(key);
        const tokens = parseFloat(data.tokens || "0");
        return { remaining: Math.floor(tokens), total: Math.floor(tokens) };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({
        event: "redis_quota_status_error",
        error: errorMsg,
      });
      return { remaining: 0, total: 0 };
    }
  }

  // Delete rate limit key
  async deleteRateLimit(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Get all keys matching a pattern
  async getKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;

    do {
      const result = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = Number(result[0]);
      keys.push(...result[1]);
    } while (cursor !== 0);

    return keys;
  }

  // Cache operations
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (expirySeconds) {
      await this.client.setex(key, expirySeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Hash operations
  async hSet(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    const result = await this.client.hget(key, field);
    return result ?? undefined;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return await this.client.hgetall(key);
  }

  // Pub/Sub for real-time updates
  async publish(channel: string, message: string): Promise<number> {
    return await this.client.publish(channel, message);
  }

  // Get connection statistics
  async getStats(): Promise<{
    connected: boolean;
    reconnectAttempts: number;
    dbSize: number;
    memoryUsage: string;
  }> {
    try {
      const info = await this.client.info("stats");
      const dbSize = await this.client.dbsize();
      const memory = await this.client.info("memory");

      const memoryMatch = memory.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch?.[1]?.trim() ?? "unknown";

      return {
        connected: this.isConnected,
        reconnectAttempts: this.reconnectAttempts,
        dbSize,
        memoryUsage,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({
        event: "redis_stats_error",
        error: errorMsg,
      });

      return {
        connected: this.isConnected,
        reconnectAttempts: this.reconnectAttempts,
        dbSize: 0,
        memoryUsage: "unknown",
      };
    }
  }

  // Increment counter
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async incrBy(key: string, increment: number): Promise<number> {
    return await this.client.incrby(key, increment);
  }

  // Expire key
  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  // Get TTL
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }
}
