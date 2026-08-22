import { db } from "../config/database";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { createHash } from "crypto";
import JWT from "../helpers/jwt";
import logger from "../utils/logger";

import { tenants } from "../database/models/tenants";
import { users } from "../database/models/user";
import { apiKeys } from "../database/models/api-keys";
import { alerts, webhooks } from "../database/models/alerts";
import { rateLimitEvents } from "../database/models/rate-limit-events";

const SEED_EMAIL = "guest@example.com";
const SEED_PASSWORD = "Password123@";
const SEED_TENANT_EMAIL = "guest-org@test.com";
const SEED_TENANT_NAME = "Guest Organization";
const SEED_FIRST_NAME = "Guest";
const SEED_LAST_NAME = "User";
const WEBHOOK_URL = "https://webhook.site/example";

async function seedTenant(dbc: ReturnType<typeof db>) {
  const existing = await dbc.query.tenants.findFirst({
    where: eq(tenants.email, SEED_TENANT_EMAIL),
  });
  if (existing) return existing;

  const rows = await dbc
    .insert(tenants)
    .values({
      name: SEED_TENANT_NAME,
      email: SEED_TENANT_EMAIL,
      plan: "pro",
      quota: 5000,
      strategy: "token_bucket",
      windowSeconds: 60,
    })
    .returning();
  return rows[0]!;
}

async function seedUser(dbc: ReturnType<typeof db>, tenantId: string) {
  const existing = await dbc.query.users.findFirst({
    where: eq(users.email, SEED_EMAIL),
  });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const rows = await dbc
    .insert(users)
    .values({
      email: SEED_EMAIL,
      password: passwordHash,
      firstName: SEED_FIRST_NAME,
      lastName: SEED_LAST_NAME,
      tenantId,
      role: "admin",
    })
    .returning();
  return rows[0]!;
}

async function seedApiKey(
  dbc: ReturnType<typeof db>,
  userId: number,
  tenantId: string,
) {
  const keyHash = createHash("sha256").update("sk_seed_test_key").digest("hex");
  const existing = await dbc.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });
  if (existing) return existing;

  await dbc.insert(apiKeys).values({
    keyHash,
    keyPrefix: "sk_seed_",
    userId,
    tenantId,
    name: "Seed Test Key",
    description: "Auto-generated seed key for testing",
    scopes: ["read", "write", "admin"],
  });
  return dbc.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, keyHash) });
}

async function seedWebhook(dbc: ReturnType<typeof db>, userId: number) {
  const existing = await dbc.query.webhooks.findFirst({
    where: eq(webhooks.url, WEBHOOK_URL),
  });
  if (existing) return existing;

  await dbc.insert(webhooks).values({
    userId,
    url: WEBHOOK_URL,
    events: ["quota_warning", "rate_limit_exceeded"],
    isActive: true,
  });
}

async function seedAlert(
  dbc: ReturnType<typeof db>,
  tenantId: string,
  userId: number,
) {
  const existing = await dbc.query.alerts.findFirst({
    where: eq(alerts.name, "Seed Quota Warning"),
  });
  if (existing) return existing;

  await dbc.insert(alerts).values({
    tenantId,
    userId,
    name: "Seed Quota Warning",
    channel: "webhook",
    type: "quota_warning",
    threshold: 80,
    isActive: true,
  });
}

async function seedEvents(
  dbc: ReturnType<typeof db>,
  tenantId: string,
  apiKeyId: number,
) {
  const countResult = await dbc
    .select({ count: sql<number>`count(*)` })
    .from(rateLimitEvents)
    .where(eq(rateLimitEvents.tenantId, tenantId));

  if (Number(countResult[0]?.count ?? 0) > 0) return;

  await dbc.insert(rateLimitEvents).values([
    {
      tenantId,
      apiKeyId,
      ipAddress: "192.168.1.1",
      endpoint: "/api/v1/data",
      method: "GET",
      statusCode: 200,
      requestDurationMs: 42,
      isBlocked: false,
      remainingQuota: 4999,
    },
    {
      tenantId,
      apiKeyId,
      ipAddress: "192.168.1.1",
      endpoint: "/api/v1/data",
      method: "POST",
      statusCode: 200,
      requestDurationMs: 87,
      isBlocked: false,
      remainingQuota: 4998,
    },
    {
      tenantId,
      apiKeyId,
      ipAddress: "10.0.0.5",
      endpoint: "/api/v1/auth",
      method: "POST",
      statusCode: 429,
      requestDurationMs: 12,
      isBlocked: true,
      remainingQuota: 0,
    },
    {
      tenantId,
      apiKeyId,
      ipAddress: "192.168.1.1",
      endpoint: "/api/v1/data",
      method: "GET",
      statusCode: 200,
      requestDurationMs: 31,
      isBlocked: false,
      remainingQuota: 4997,
    },
    {
      tenantId,
      apiKeyId,
      ipAddress: "203.0.113.1",
      endpoint: "/api/v1/admin",
      method: "GET",
      statusCode: 403,
      requestDurationMs: 5,
      isBlocked: true,
      remainingQuota: 4996,
    },
  ]);
}

export async function seed() {
  const shouldClean = process.argv.includes("--clean");

  if (shouldClean) {
    const dbc = db();
    await dbc.delete(rateLimitEvents);
    await dbc.delete(alerts);
    await dbc.delete(webhooks);
    await dbc.delete(apiKeys);
    await dbc.delete(users);
    await dbc.delete(tenants);
    logger.info("Seed data cleaned");
    return;
  }

  const dbc = db();

  const tenant = await seedTenant(dbc);
  const user = await seedUser(dbc, tenant.id);
  const apiKey = await seedApiKey(dbc, user.id, tenant.id);
  await seedWebhook(dbc, user.id);
  await seedAlert(dbc, tenant.id, user.id);
  if (apiKey) await seedEvents(dbc, tenant.id, apiKey.id);

  const token = JWT.encode(
    {
      id: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
    },
    86400,
  );

  const webhookList = await dbc.query.webhooks.findMany({
    where: eq(webhooks.userId, user.id),
  });

  console.log("\n✓ Database seeded successfully\n");
  console.log("==============================================");
  console.log("  SEED DATA");
  console.log("==============================================");
  console.log(`  Email:      ${SEED_EMAIL}`);
  console.log(`  Password:   ${SEED_PASSWORD}`);
  console.log(`  Tenant ID:  ${tenant.id}`);
  console.log(`  User ID:    ${user.id}`);
  console.log(`  API Key ID: ${apiKey?.id ?? "N/A"}`);
  console.log("==============================================\n");

  console.log("==============================================");
  console.log("  CURL COMMANDS");
  console.log("==============================================\n");

  const AUTH = `Authorization: Bearer ${token}`;
  const BASE = "http://localhost:8080";

  console.log("# --- Health ---");
  console.log(`curl -s ${BASE}/health | python3 -m json.tool\n`);

  console.log("# --- Auth ---");
  console.log(`curl -s -X POST ${BASE}/auth/login \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(
    `  -d '{"email":"${SEED_EMAIL}","password":"${SEED_PASSWORD}"}' | python3 -m json.tool\n`,
  );

  console.log(`curl -s -X POST ${BASE}/auth/refresh \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H '${AUTH}' \\`);
  console.log(`  -d '{"token":"${token}"}' | python3 -m json.tool\n`);

  console.log("# --- API Keys ---");
  console.log(
    `curl -s ${BASE}/api-keys/keys -H '${AUTH}' | python3 -m json.tool\n`,
  );
  console.log(`curl -s -X POST ${BASE}/api-keys/keys \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H '${AUTH}' \\`);
  console.log(
    `  -d '{"name":"New Test Key","scopes":["read"]}' | python3 -m json.tool\n`,
  );

  if (apiKey) {
    console.log(
      `curl -s ${BASE}/api-keys/keys/${apiKey.id} -H '${AUTH}' | python3 -m json.tool\n`,
    );
    console.log(`curl -s -X PATCH ${BASE}/api-keys/keys/${apiKey.id} \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -H '${AUTH}' \\`);
    console.log(
      `  -d '{"description":"Updated description"}' | python3 -m json.tool\n`,
    );
    console.log(
      `curl -s -X DELETE ${BASE}/api-keys/keys/${apiKey.id} -H '${AUTH}' | python3 -m json.tool\n`,
    );
  }

  console.log("# --- Tenants ---");
  console.log(`curl -s ${BASE}/tenants -H '${AUTH}' | python3 -m json.tool\n`);
  console.log(
    `curl -s ${BASE}/tenants/${tenant.id} -H '${AUTH}' | python3 -m json.tool\n`,
  );

  console.log("# --- Analytics ---");
  console.log(
    `curl -s '${BASE}/analytics?tenantId=${tenant.id}' -H '${AUTH}' | python3 -m json.tool\n`,
  );

  console.log("# --- Alerts ---");
  console.log(`curl -s ${BASE}/alerts -H '${AUTH}' | python3 -m json.tool\n`);

  console.log("# --- Webhooks (CRUD) ---");
  console.log(`curl -s -X POST ${BASE}/webhooks \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H '${AUTH}' \\`);
  console.log(
    `  -d '{"url":"https://example.com/webhook","events":["quota_warning"],"secret":"sekret"}' | python3 -m json.tool\n`,
  );
  console.log(`curl -s ${BASE}/webhooks -H '${AUTH}' | python3 -m json.tool\n`);

  if (webhookList.length > 0) {
    console.log(
      `curl -s ${BASE}/webhooks/${webhookList[0]?.id} -H '${AUTH}' | python3 -m json.tool\n`,
    );
    console.log(`curl -s -X PATCH ${BASE}/webhooks/${webhookList[0]?.id} \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -H '${AUTH}' \\`);
    console.log(`  -d '{"isActive":false}' | python3 -m json.tool\n`);
    console.log(
      `curl -s -X DELETE ${BASE}/webhooks/${webhookList[0]?.id} -H '${AUTH}' | python3 -m json.tool\n`,
    );
  }

  console.log("==============================================\n");
  console.log("Quick smoke test:\n");
  console.log(`  TOKEN="${token}"`);
  console.log(`  curl -s ${BASE}/health | python3 -m json.tool`);
  console.log(
    `  curl -s ${BASE}/api-keys/keys -H "Authorization: Bearer \$TOKEN" | python3 -m json.tool`,
  );
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
