import type { ServerWebSocket } from "bun";
import type { RedisClient } from "../services/redis";
import type { DatabaseClient } from "../services/database";
import logger from "../utils/logger";

export interface WebSocketData {
  connectedAt: number;
  apiKey: string | null;
  tenantId?: string;
}

// Connection registry
const connections = new Map<ServerWebSocket<WebSocketData>, WebSocketData>();

export const websocketHandlers = {
  onOpen(
    ws: ServerWebSocket<WebSocketData>,
    redis: RedisClient,
    db: DatabaseClient,
  ) {
    connections.set(ws, ws.data);

    logger.info({
      event: "websocket_connected",
      totalConnections: connections.size,
      connectedAt: ws.data.connectedAt,
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        message: "Connected to RateLimitr real-time stream",
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
          await handleSubscribe(ws, data, redis);
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

// Authenticate WebSocket connection
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

  // TODO: Validate API key against database
  // For now, just accept it
  ws.data.apiKey = apiKey;

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

// Subscribe to specific events
async function handleSubscribe(
  ws: ServerWebSocket<WebSocketData>,
  data: any,
  redis: RedisClient,
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

  // TODO: Implement subscription logic
  ws.send(
    JSON.stringify({
      type: "subscribed",
      channels: data.channels || [],
      timestamp: Date.now(),
    }),
  );
}

// Unsubscribe from events
async function handleUnsubscribe(
  ws: ServerWebSocket<WebSocketData>,
  data: any,
  redis: RedisClient,
) {
  // TODO: Implement unsubscription logic
  ws.send(
    JSON.stringify({
      type: "unsubscribed",
      channels: data.channels || [],
      timestamp: Date.now(),
    }),
  );
}

// Broadcast to all authenticated connections
export function broadcastToAuthenticated(message: any) {
  const payload = JSON.stringify(message);
  let sent = 0;

  for (const [ws, data] of connections.entries()) {
    if (data.apiKey && ws.readyState === 1) {
      // 1 = OPEN
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

// Broadcast quota violation event
export function broadcastQuotaViolation(tenantId: string, details: any) {
  const message = {
    type: "quota_violation",
    tenantId,
    details,
    timestamp: Date.now(),
  };

  return broadcastToAuthenticated(message);
}

// Get connection stats
export function getConnectionStats() {
  const authenticated = Array.from(connections.values()).filter(
    (data) => data.apiKey !== null,
  ).length;

  return {
    total: connections.size,
    authenticated,
    unauthenticated: connections.size - authenticated,
  };
}
