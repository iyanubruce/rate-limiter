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

const SEED_EMAIL = "seed@test.com";
const SEED_PASSWORD = "password123";
const SEED_TENANT_EMAIL = "seed-org@test.com";
const SEED_TENANT_NAME = "Seed Organization";
const SEED_FIRST_NAME = "Seed";
const SEED_LAST_NAME = "User";
const WEBHOOK_URL = "https://webhook.site/example";

async function seed() {
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

  const existingTenant = await dbc.query.tenants.findFirst({
    where: eq(tenants.email, SEED_TENANT_EMAIL),
  });

  let tenant = existingTenant;
  if (!tenant) {
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
    tenant = rows[0]!;
  }

  if (!tenant) {
    logger.error("Failed to create tenant");
    process.exit(1);
  }

  const existingUser = await dbc.query.users.findFirst({
    where: eq(users.email, SEED_EMAIL),
  });

  let user = existingUser;
  if (!user) {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const rows = await dbc
      .insert(users)
      .values({
        email: SEED_EMAIL,
        password: passwordHash,
        firstName: SEED_FIRST_NAME,
        lastName: SEED_LAST_NAME,
        tenantId: tenant.id,
        role: "admin",
      })
      .returning();
    user = rows[0]!;
  }

  const token = JWT.encode(
    {
      id: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
    },
    86400,
  );

  const keyHash = createHash("sha256").update("sk_seed_test_key").digest("hex");
  const existingKey = await dbc.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });
  if (!existingKey) {
    await dbc.insert(apiKeys).values({
      keyHash,
      keyPrefix: "sk_seed_",
      userId: user.id,
      tenantId: tenant.id,
      name: "Seed Test Key",
      description: "Auto-generated seed key for testing",
      scopes: ["read", "write", "admin"],
    });
  }

  const existingWebhook = await dbc.query.webhooks.findFirst({
    where: eq(webhooks.url, WEBHOOK_URL),
  });
  if (!existingWebhook) {
    await dbc.insert(webhooks).values({
      userId: user.id,
      url: WEBHOOK_URL,
      events: ["quota_warning", "rate_limit_exceeded"],
      isActive: true,
    });
  }

  const existingAlert = await dbc.query.alerts.findFirst({
    where: eq(alerts.name, "Seed Quota Warning"),
  });
  if (!existingAlert) {
    await dbc.insert(alerts).values({
      tenantId: tenant.id,
      userId: user.id,
      name: "Seed Quota Warning",
      channel: "webhook",
      type: "quota_warning",
      threshold: 80,
      isActive: true,
    });
  }

  const countResult = await dbc
    .select({ count: sql<number>`count(*)` })
    .from(rateLimitEvents)
    .where(eq(rateLimitEvents.tenantId, tenant.id));

  const existingEventCount = Number(countResult[0]?.count ?? 0);
  if (existingEventCount === 0) {
    const apiKey = await dbc.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (apiKey) {
      await dbc.insert(rateLimitEvents).values([
        {
          tenantId: tenant.id,
          apiKeyId: apiKey.id,
          ipAddress: "192.168.1.1",
          endpoint: "/api/v1/data",
          method: "GET",
          statusCode: 200,
          requestDurationMs: 42,
          isBlocked: false,
          remainingQuota: 4999,
        },
        {
          tenantId: tenant.id,
          apiKeyId: apiKey.id,
          ipAddress: "192.168.1.1",
          endpoint: "/api/v1/data",
          method: "POST",
          statusCode: 200,
          requestDurationMs: 87,
          isBlocked: false,
          remainingQuota: 4998,
        },
        {
          tenantId: tenant.id,
          apiKeyId: apiKey.id,
          ipAddress: "10.0.0.5",
          endpoint: "/api/v1/auth",
          method: "POST",
          statusCode: 429,
          requestDurationMs: 12,
          isBlocked: true,
          remainingQuota: 0,
        },
        {
          tenantId: tenant.id,
          apiKeyId: apiKey.id,
          ipAddress: "192.168.1.1",
          endpoint: "/api/v1/data",
          method: "GET",
          statusCode: 200,
          requestDurationMs: 31,
          isBlocked: false,
          remainingQuota: 4997,
        },
        {
          tenantId: tenant.id,
          apiKeyId: apiKey.id,
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
  }

  const apiKey = await dbc.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });

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
