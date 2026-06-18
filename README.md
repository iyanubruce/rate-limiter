# RateLimitr

**Rate limit anything. In real time.**

RateLimitr is a multi-tenant rate limiting platform that gives you full control over how your API is consumed. Four strategies, plan-based pricing with Stripe billing, real-time analytics on TimescaleDB, and live metrics over WebSocket. Built for SaaS companies that need to throttle, monitor, and bill for API usage at scale.

Backend repository → [github.com/iyanubruce/rate-limiter](https://github.com/iyanubruce/rate-limiter)

---

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Keys](#api-keys)
- [Rate Limit Check](#rate-limit-check)
- [Rate Limiting Strategies](#rate-limiting-strategies)
- [WebSocket Stream](#websocket-stream)
- [Analytics](#analytics)
- [Billing](#billing)
- [Rate Limit Headers](#rate-limit-headers)
- [Error Codes](#error-codes)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)

---

## Getting Started

Sign up at `https://yourapp.com/auth/register` and you'll receive a **tenant ID** and can create your first **API key** from the dashboard.

Every API request uses your API key in the `x-api-key` header. All rate limits and analytics are scoped to your tenant.

**Quick start:**

```bash
# Register your account
curl -X POST https://yourapp.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","firstName":"John","lastName":"Doe","organizationName":"My Company","organizationEmail":"billing@mycompany.com"}'

# Login
curl -X POST https://yourapp.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'
```

---

## Authentication

The Admin API uses JWT bearer tokens for authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account. Body: `{ email, password, firstName, lastName, organizationName, organizationEmail }` |
| POST | `/auth/login` | Login. Body: `{ email, password }`. Returns `{ token, user }` |
| POST | `/auth/refresh` | Refresh JWT. Body: `{ refreshToken }` |
| POST | `/auth/google` | Google OAuth |

Include the token in all authenticated requests:

```
Authorization: Bearer <your_jwt_token>
```

The token contains `id`, `tenantId`, `email`, and `role`.

---

## API Keys

Create and manage API keys from the dashboard or programmatically. Keys are the credentials your users send in the `x-api-key` header when calling the rate limit check endpoint.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api-keys/keys` | Create a key. Body: `{ name, scopes?, rateLimitOverride?, expiresAt? }` |
| GET | `/api-keys/keys` | List keys. Query: `?limit&offset&status&search` |
| GET | `/api-keys/keys/:keyId` | Get a single key |
| PATCH | `/api-keys/keys/:keyId` | Update key name, scopes, or rate limit override |
| DELETE | `/api-keys/keys/:keyId` | Revoke a key |

**Scopes:** `read`, `write`, `admin`

**Rate limit override** — set per-key limits that override the tenant defaults:

```json
{
  "requestsPerSecond": 500,
  "burstSize": 100,
  "windowMs": 60000,
  "strategy": "token-bucket"
}
```

The full API key value (`sk_live_...`) is returned once on creation. Store it securely.

---

## Rate Limit Check

The traffic service processes rate limit decisions. This is the endpoint your application calls on every request.

```
POST https://api.yourapp.com/v1/check
Headers:
  x-api-key: <your_api_key>
  Content-Type: application/json
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | yes | Your tenant ID from the dashboard |
| `identifier` | string | yes | Unique ID for the entity being rate-limited (user ID, IP, session, etc.) |
| `endpoint` | string | no | The endpoint being accessed — logged for analytics |
| `method` | string | no | HTTP method — logged for analytics |
| `strategy` | string | no | Override strategy: `fixed_window`, `token_bucket`, `leaky_bucket`, or `sliding_window`. Falls back to your plan default |
| `weight` | integer | no | Cost of this request (default: 1). A weight of 5 counts as 5 requests |

**200 — Allowed:**

```json
{
  "allowed": true,
  "remaining": 42,
  "resetAt": 1718000000,
  "limit": 100,
  "strategy": "token_bucket"
}
```

**429 — Rate Limited:**

```json
{
  "allowed": false,
  "remaining": 0,
  "resetAt": 1718000060,
  "limit": 100,
  "strategy": "token_bucket",
  "retryAfter": 45
}
```

**cURL example:**

```bash
curl -X POST https://api.yourapp.com/v1/check \
  -H "x-api-key: rl_key_abc123def456" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"org_xxx","identifier":"user:123","endpoint":"/api/users","method":"GET"}'
```

**JavaScript example:**

```javascript
const response = await fetch("https://api.yourapp.com/v1/check", {
  method: "POST",
  headers: {
    "x-api-key": "rl_key_abc123def456",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    tenantId: "org_xxx",
    identifier: "user:123",
    endpoint: "/api/users",
    method: "GET",
  }),
});

const data = await response.json();

if (response.status === 429) {
  const retryAfter = data.retryAfter;
  console.log(`Rate limited. Retry in ${retryAfter}s`);
  setTimeout(() => retryRequest(), retryAfter * 1000);
} else {
  console.log(`Allowed. ${data.remaining}/${data.limit} remaining`);
}
```

**Python example:**

```python
import requests

response = requests.post(
    "https://api.yourapp.com/v1/check",
    headers={"x-api-key": "rl_key_abc123def456"},
    json={
        "tenantId": "org_xxx",
        "identifier": "user:123",
        "endpoint": "/api/users",
        "method": "GET",
    },
)

data = response.json()
if response.status_code == 429:
    print(f"Rate limited. Retry in {data['retryAfter']}s")
else:
    print(f"Allowed. {data['remaining']}/{data['limit']} remaining")
```

---

## Rate Limiting Strategies

Four algorithms implemented as atomic Lua scripts running in Redis. Strategy selection depends on your plan.

| Strategy | Plans | Behavior |
|----------|-------|----------|
| `fixed_window` | Free, Pro, Enterprise | Counts requests in a fixed time window (e.g., 1000 per minute). Resets at the boundary. Simple and predictable |
| `token_bucket` | Pro, Enterprise | Tokens refill at a configurable rate. Allows bursts up to bucket capacity. Smooths traffic over time |
| `leaky_bucket` | Pro, Enterprise | Processes requests at a constant rate. Excess is queued and processed as capacity frees up |
| `sliding_window` | Enterprise | Evaluates request count over a rolling time window using data from the previous window. No boundary spikes |

**Strategy resolution order:**
1. Request body `strategy` field
2. Per-key `rateLimitOverride.strategy` (set in dashboard)
3. Tenant's default strategy

---

## WebSocket Stream

Connect to the real-time event stream to monitor rate limit decisions, metrics, and alerts as they happen.

```
wss://api.yourapp.com/ws
```

**Protocol:**

1. **Connect** — server responds with available channels

```json
{ "type": "connected", "availableChannels": ["events", "metrics", "alerts", "blocks"] }
```

2. **Authenticate** — send your API key

```json
{ "type": "authenticate", "apiKey": "rl_key_abc123def456" }
```

Response: `{ "type": "authenticated", "timestamp": 1718000000 }`

3. **Subscribe** to channels

```json
{ "type": "subscribe", "channels": ["events", "metrics"] }
```

Response: `{ "type": "subscribed", "channels": ["events", "metrics"], "timestamp": 1718000000 }`

4. **Receive real-time events**

**Events channel** — every rate limit decision:
```json
{
  "type": "block",
  "data": {
    "identifier": "user:123",
    "endpoint": "/api/resource",
    "strategy": "token_bucket",
    "remaining": 0
  },
  "timestamp": 1718000000
}
```

**Metrics channel** — every 5 seconds:
```json
{
  "type": "metrics",
  "data": {
    "connectedClients": 12,
    "usedMemory": "2.5M",
    "totalCommandsProcessed": 104200,
    "instantaneousOpsPerSec": 340,
    "uptime": 7
  },
  "timestamp": 1718000000
}
```

5. **Keep alive** — send pings

```json
{ "type": "ping" }  →  { "type": "pong", "timestamp": 1718000000 }
```

**JavaScript example:**

```javascript
const ws = new WebSocket("wss://api.yourapp.com/ws");

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg);
};

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "authenticate", apiKey: "rl_key_abc123def456" }));
  ws.send(JSON.stringify({ type: "subscribe", channels: ["events", "metrics"] }));
};
```

---

## Analytics

Every rate limit check is queued via BullMQ and stored in a TimescaleDB hypertable. Query usage patterns, blocked requests, and traffic trends.

All analytics endpoints require JWT auth and accept common query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | ISO date — start of range (default: 24h ago) |
| `endDate` | string | ISO date — end of range (default: now) |
| `tenantId` | string | Your tenant ID |
| `limit` | integer | Results per page |
| `offset` | integer | Pagination offset |

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/analytics/overview` | `{ totalRequests, blockedRequests, blockRate, avgResponseTimeMs, topEndpoints }` |
| GET | `/analytics/events` | Paginated rate limit events |
| GET | `/analytics/timeseries` | Time-bucketed request counts (for charts). Query: `?interval=1m|5m|1h|1d` |
| GET | `/analytics/top-blocked` | Most-blocked IPs and endpoints |
| GET | `/analytics/patterns` | Suspicious traffic patterns, burst detection, top talkers |
| GET | `/analytics/endpoints` | Per-endpoint stats: total, blocked, block rate, avg duration |
| GET | `/analytics/status-codes` | Status code distribution |
| GET | `/analytics/ip-addresses` | Per-IP stats: requests, blocks, block rate, unique endpoints |

---

## Billing

Upgrade your plan via Stripe Checkout.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tenants/upgrade` | Body: `{ plan: "pro" | "enterprise" }`. Returns `{ url }` — redirect to Stripe |

**Plan tiers:**

| Plan | Strategies | Price |
|------|-----------|-------|
| Free | `fixed_window` | $0 |
| Pro | `fixed_window`, `token_bucket`, `leaky_bucket` | $29/month |
| Enterprise | All four strategies | Custom |

After successful Stripe payment, the webhook handler (`POST /webhooks/stripe`) updates your plan and invalidates the Redis cache so new limits apply immediately.

---

## Rate Limit Headers

Every check response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests in the current window |
| `X-RateLimit-Remaining` | Requests remaining in this window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds to wait (only on 429 responses) |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Invalid request — check your body fields |
| 401 | Bad or missing API key — verify your `x-api-key` header |
| 403 | Forbidden — the key belongs to another tenant |
| 404 | Resource not found |
| 429 | Rate limit exceeded — use `Retry-After` to back off |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Admin API port |
| `TRAFFIC_PORT` | 3001 | Traffic service port |
| `DB_HOST` / `DB_PORT` | localhost / 5432 | PostgreSQL |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | ratelimitr | Database credentials |
| `REDIS_HOST` / `REDIS_PORT` | localhost / 6379 | Redis |
| `JWT_SECRET` | secret | JWT signing key |
| `STRIPE_SECRET_KEY` | — | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `STRIPE_PRICE_PRO` | — | Stripe price ID for Pro plan |
| `STRIPE_PRICE_ENTERPRISE` | — | Stripe price ID for Enterprise plan |
| `LOG_LEVEL` | info | Log level |

---

## Scripts

```bash
bun install              # Install dependencies
bun run dev:admin        # Start admin API (hot-reload)
bun run dev:traffic      # Start traffic service (hot-reload)
bun run dev:consumers    # Start BullMQ worker (hot-reload)
bun run db:generate      # Generate migration from schema diff
bun run db:migrate       # Apply pending migrations
bun run db:push          # Push schema directly (dev only)
bun run db:studio        # Drizzle Studio GUI
bun run embed:lua        # Embed Lua scripts into TS bundle
```

---

## Architecture

```
Client → Admin API (Fastify) ──┬── Redis (Lua rate limit scripts)
                               ├── PostgreSQL + TimescaleDB
                               └── BullMQ → Worker → TimescaleDB

Client → Traffic (Bun HTTP) ──── Redis (Lua scripts)
                                └── PostgreSQL (key lookup)
```

| Component | Choice |
|-----------|--------|
| Runtime | Bun |
| Admin API | Fastify + TypeScript |
| Traffic handler | Bun native HTTP |
| Database | PostgreSQL + TimescaleDB |
| Cache | Redis (ioredis) |
| Rate limiting | Lua scripts in Redis (EVALSHA) |
| Queue | BullMQ |
| Billing | Stripe |
| Auth | JWT + bcrypt |
| ORM | Drizzle ORM |
| Validation | Zod |
| Logging | Winston |
| Docs | Swagger (`/docs`) |
| WebSocket | Bun native (`ws://`) |
