import type { ServerWebSocket } from "bun";
import type { DatabaseClient } from "../config/database";
import logger from "../utils/logger";
import { getDbClient } from "../config/database";
import { createHash } from "crypto";
import ApiKeyRepository from "../database/repositories/api-keys";
import type RedisClient from "../services/redis";
export interface WebSocketData {
  connectedAt: number;
  apiKey: string | null;
  tenantId?: string;
}

// Connection registry
const connections = new Map<ServerWebSocket<WebSocketData>, WebSocketData>();
const subscriptions = new Map<ServerWebSocket<WebSocketData>, Set<string>>();
const metricsInterval: Map<string, NodeJS.Timeout> = new Map();

export interface WebSocketData {
  connectedAt: number;
  apiKey: string | null;
  tenantId?: string;
  subscriptions?: Set<string>;
}

export const websocketHandlers = {
  onOpen(
    ws: ServerWebSocket<WebSocketData>,
    redis: RedisClient,
    db: DatabaseClient,
  ) {
    ws.data.subscriptions = new Set();
    connections.set(ws, ws.data);

    logger.info({
      event: "websocket_connected",
      totalConnections: connections.size,
      connectedAt: ws.data.connectedAt,
    });

    ws.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        message: "Connected to RateLimitr real-time stream",
        availableChannels: ["events", "metrics", "alerts", "blocks"],
      }),
    );
  },

  async onMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: string | Buffer,
    redis: RedisClient,
    db: DatabaseClient,
  ) {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "authenticate":
          await handleAuthentication(ws, data, redis, db);
          break;

        case "subscribe":
          await handleSubscribe(ws, data, redis, db);
          break;

        case "unsubscribe":
          await handleUnsubscribe(ws, data, redis);
          break;

        case "ping":
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: Date.now(),
            }),
          );
          break;

        default:
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Unknown message type",
              timestamp: Date.now(),
            }),
          );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({
        event: "websocket_message_error",
        error: errorMsg,
      });

      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
          timestamp: Date.now(),
        }),
      );
    }
  },

  onClose(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
    const subs = subscriptions.get(ws);
    if (subs) {
      subs.clear();
      subscriptions.delete(ws);
    }
    connections.delete(ws);

    logger.info({
      event: "websocket_closed",
      totalConnections: connections.size,
      code,
      reason,
    });
  },

  onError(ws: ServerWebSocket<WebSocketData>, error: Error) {
    logger.error({
      event: "websocket_error",
      error: error.message,
      stack: error.stack,
    });
  },
};

async function handleAuthentication(
  ws: ServerWebSocket<WebSocketData>,
  data: any,
  redis: RedisClient,
  db: DatabaseClient,
) {
  const { apiKey } = data;

  if (!apiKey || typeof apiKey !== "string") {
    ws.send(
      JSON.stringify({
        type: "auth_error",
        message: "Invalid API key",
        timestamp: Date.now(),
      }),
    );
    return;
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const drizzleInstance = getDbClient().getDb();
  const apiKeyRepo = new ApiKeyRepository(drizzleInstance);
  const keyRecord = await apiKeyRepo.getValidApiKeyByKeyHash(keyHash);

  if (!keyRecord) {
    ws.send(
      JSON.stringify({
        type: "auth_error",
        message: "Invalid API key",
        timestamp: Date.now(),
      }),
    );
    return;
  }

  ws.data.apiKey = apiKey;
  ws.data.tenantId = String(keyRecord.tenantId ?? "");

  ws.send(
    JSON.stringify({
      type: "authenticated",
      timestamp: Date.now(),
    }),
  );

  logger.info({
    event: "websocket_authenticated",
    apiKey: apiKey.substring(0, 10) + "...",
  });
}

async function handleSubscribe(
  ws: ServerWebSocket<WebSocketData>,
  data: any,
  redis: RedisClient,
  db: DatabaseClient,
) {
  if (!ws.data.apiKey) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Authentication required",
        timestamp: Date.now(),
      }),
    );
    return;
  }

  const channels = data.channels || [];
  const validChannels = ["events", "metrics", "alerts", "blocks"];
  const subscribedChannels: string[] = [];

  for (const channel of channels) {
    if (validChannels.includes(channel)) {
      if (!ws.data.subscriptions) {
        ws.data.subscriptions = new Set();
      }
      ws.data.subscriptions.add(channel);
      subscribedChannels.push(channel);

      if (channel === "metrics" && !metricsInterval.has(String(ws.data.tenantId))) {
        const interval = setInterval(async () => {
          try {
            const metricsData = await gatherMetrics(redis, db);
            ws.send(
              JSON.stringify({
                type: "metrics",
                data: metricsData,
                timestamp: Date.now(),
              }),
            );
          } catch (error) {
            logger.error({ event: "metrics_gather_error", error });
          }
        }, 5000);
        metricsInterval.set(String(ws.data.tenantId), interval);
      }
    }
  }

  if (ws.data.subscriptions) {
    subscriptions.set(ws, ws.data.subscriptions);
  }

  ws.send(
    JSON.stringify({
      type: "subscribed",
      channels: subscribedChannels,
      timestamp: Date.now(),
    }),
  );
}

async function handleUnsubscribe(
  ws: ServerWebSocket<WebSocketData>,
  data: any,
  redis: RedisClient,
) {
  const channels = data.channels || [];
  const unsubscribedChannels: string[] = [];

  for (const channel of channels) {
    if (ws.data.subscriptions?.has(channel)) {
      ws.data.subscriptions.delete(channel);
      unsubscribedChannels.push(channel);

      if (channel === "metrics") {
        const interval = metricsInterval.get(String(ws.data.tenantId));
        if (interval) {
          clearInterval(interval);
          metricsInterval.delete(String(ws.data.tenantId));
        }
      }
    }
  }

  if (ws.data.subscriptions) {
    subscriptions.set(ws, ws.data.subscriptions);
  }

  ws.send(
    JSON.stringify({
      type: "unsubscribed",
      channels: unsubscribedChannels,
      timestamp: Date.now(),
    }),
  );
}

async function gatherMetrics(redis: RedisClient, db: DatabaseClient) {
  const info = await redis.client.info("stats");
  const parsedInfo = parseRedisInfo(info);

  return {
    connectedClients: parsedInfo.connected_clients || 0,
    usedMemory: parsedInfo.used_memory_human || "0",
    totalCommandsProcessed: parsedInfo.total_commands_processed || 0,
    instantaneousOpsPerSec: parsedInfo.instantaneous_ops_per_sec || 0,
    uptime: parsedInfo.uptime_in_days || 0,
  };
}

function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of info.split("\r\n")) {
    if (line && !line.startsWith("#")) {
      const [key, value] = line.split(":");
      if (key && value) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function broadcastToAuthenticated(message: any) {
  const payload = JSON.stringify(message);
  let sent = 0;

  for (const [ws, data] of connections.entries()) {
    if (data.apiKey && ws.readyState === 1) {
      try {
        ws.send(payload);
        sent++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({
          event: "websocket_broadcast_error",
          error: errorMsg,
        });
      }
    }
  }

  return sent;
}

export function broadcastToChannel(channel: string, message: any) {
  const payload = JSON.stringify(message);
  let sent = 0;

  for (const [ws, subs] of subscriptions.entries()) {
    if (subs.has(channel) && ws.readyState === 1) {
      try {
        ws.send(payload);
        sent++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({
          event: "websocket_broadcast_error",
          error: errorMsg,
        });
      }
    }
  }

  return sent;
}

export function broadcastQuotaViolation(tenantId: string, details: any) {
  const message = {
    type: "quota_violation",
    tenantId,
    details,
    timestamp: Date.now(),
  };

  return broadcastToAuthenticated(message);
}

export function broadcastBlockEvent(details: any) {
  const message = {
    type: "block",
    data: details,
    timestamp: Date.now(),
  };

  return broadcastToChannel("blocks", message) + broadcastToChannel("events", message);
}

export function broadcastAlert(alertType: string, details: any) {
  const message = {
    type: alertType,
    data: details,
    timestamp: Date.now(),
  };

  return broadcastToChannel("alerts", message);
}

export function getConnectionStats() {
  const authenticated = Array.from(connections.values()).filter(
    (data) => data.apiKey !== null,
  ).length;

  const channelCounts: Record<string, number> = {};
  for (const subs of subscriptions.values()) {
    for (const channel of subs) {
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    }
  }

  return {
    total: connections.size,
    authenticated,
    unauthenticated: connections.size - authenticated,
    channelCounts,
  };
}
