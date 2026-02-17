import Redis, {
  type Redis as RedisClientType,
  type RedisOptions,
} from "ioredis";
import logger from "../utils/logger";
import { loadAllLuaScripts } from "../utils/load-lua-scripts";

// Hybrid loading: embedded (prod) or runtime (dev)
let LUA_SCRIPTS: Record<string, string>;
let USING_EMBEDDED = false;

LUA_SCRIPTS = await loadAllLuaScripts();

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
  private scriptShas: Record<string, string> = {};

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
          return null;
        }
        const delay = Math.min(retries * 100, this.config.retryDelay || 1000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    };

    this.client = new Redis(options);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on("connect", () => {
      logger.info("Redis client connecting...");
    });

    this.client.on("ready", async () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info("Redis client ready");
      await this.loadScriptShas();
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

  private async loadScriptShas() {
    for (const [name, script] of Object.entries(LUA_SCRIPTS)) {
      try {
        const sha = (await this.client.script("LOAD", script)) as string;
        this.scriptShas[name] = sha;
        logger.debug(`Loaded script SHA for ${name}: ${sha}`);
      } catch (error) {
        logger.error(`Failed to load script SHA for ${name}:`, error);
      }
    }
  }

  private async evalWithFallback(
    scriptName: string,
    keys: string[],
    args: string[],
  ): Promise<any> {
    const sha = this.scriptShas[scriptName];

    if (sha) {
      try {
        return await this.client.evalsha(sha, keys.length, ...keys, ...args);
      } catch (error: any) {
        if (error.message?.includes("NOSCRIPT")) {
          logger.warn(`Script ${scriptName} not cached, using eval fallback`);

          // Fix: use .call() or assertion to bypass bad overload
          const newSha = (await this.client.call(
            "SCRIPT",
            "LOAD",
            LUA_SCRIPTS[scriptName]!,
          )) as string;

          // Alternative with assertion on .script():
          // const newSha = await (this.client.script as any)("LOAD", LUA_SCRIPTS[scriptName]!) as string;

          this.scriptShas[scriptName] = newSha;

          return await this.client.evalsha(
            newSha,
            keys.length,
            ...keys,
            ...args,
          );
        }
        throw error;
      }
    }

    // No SHA → direct eval
    const script = LUA_SCRIPTS[scriptName];
    if (!script) {
      throw new Error(`Lua script missing for ${scriptName}`);
    }

    return await this.client.eval(script, keys.length, ...keys, ...args);
  }

  async connect(): Promise<void> {
    try {
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
      logger.error({ event: "redis_disconnect_error", error: errorMsg });
      throw error;
    }
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  isReady(): boolean {
    return this.isConnected && this.client.status === "ready";
  }

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    strategy:
      | "token_bucket"
      | "sliding_window"
      | "leaky_bucket" = "token_bucket",
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
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

  private async tokenBucket(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const result = (await this.evalWithFallback(
      "tokenBucket",
      [key],
      [limit.toString(), windowSeconds.toString(), now.toString()],
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      resetAt: result[2] ?? 0,
    };
  }

  private async slidingWindow(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    const result = (await this.evalWithFallback(
      "slidingWindow",
      [key],
      [
        limit.toString(),
        windowStart.toString(),
        now.toString(),
        windowMs.toString(),
      ],
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      resetAt: result[2] ?? now + windowMs,
    };
  }

  private async leakyBucket(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const leakRate = limit / windowSeconds;

    const result = (await this.evalWithFallback(
      "leakyBucket",
      [key],
      [limit.toString(), leakRate.toString(), now.toString()],
    )) as [number, number, number];

    if (!result) throw new Error("No result");

    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      resetAt: result[2] ?? 0,
    };
  }

  async fixedWindowRateLimit(
    key: string,
    timeWindow: number,
    max: number,
    continueExceeding: boolean,
    exponentialBackoff: boolean,
  ): Promise<{ current: number; timeWindow: number }> {
    const result = (await this.evalWithFallback(
      "rateLimit",
      [key],
      [
        timeWindow.toString(),
        max.toString(),
        continueExceeding.toString(),
        exponentialBackoff.toString(),
      ],
    )) as [number, number];

    return {
      current: result[0] ?? 0,
      timeWindow: result[1] ?? 0,
    };
  }

  async getQuotaStatus(
    key: string,
    strategy: string,
  ): Promise<{ remaining: number; total: number }> {
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
      logger.error({ event: "redis_quota_status_error", error: errorMsg });
      return { remaining: 0, total: 0 };
    }
  }

  async deleteRateLimit(key: string): Promise<void> {
    await this.client.del(key);
  }

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

  async publish(channel: string, message: string): Promise<number> {
    return await this.client.publish(channel, message);
  }

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
      logger.error({ event: "redis_stats_error", error: errorMsg });

      return {
        connected: this.isConnected,
        reconnectAttempts: this.reconnectAttempts,
        dbSize: 0,
        memoryUsage: "unknown",
      };
    }
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async incrBy(key: string, increment: number): Promise<number> {
    return await this.client.incrby(key, increment);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }
}
