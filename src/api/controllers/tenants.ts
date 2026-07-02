import TenantRepo from "../../database/repositories/tenant";
import { db } from "../../config/database";
import { BadRequestError, InternalServerError } from "../../error";
import { createCheckoutSession, createCustomer } from "../../services/stripe";
import Redis from "../../services/redis";
import config from "../../config/env";
import { apiKeys } from "../../database/models";
import { eq } from "drizzle-orm";

const tenantRepo = new TenantRepo(db());
const redis = new Redis(config.redis);

const PLAN_IDS = {
  pro: 1,
  enterprise: 2,
} as const;

export type Plan = keyof typeof PLAN_IDS;

export async function upgradePlan(tenantId: string, plan: Plan) {
  if (!(plan in PLAN_IDS)) {
    throw new BadRequestError(
      `Invalid plan "${plan}". Must be one of: ${Object.keys(PLAN_IDS).join(", ")}`,
    );
  }

  const tenant = await tenantRepo.getTenant({ id: tenantId });
  if (!tenant) {
    throw new BadRequestError("Tenant not found");
  }

  if (tenant.plan === plan) {
    throw new BadRequestError(`Already on the ${plan} plan`);
  }

  let stripeCustomerId = tenant.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await createCustomer(tenant.email, tenant.name);
    stripeCustomerId = customer.id;
    await tenantRepo.updateTenant(tenantId, { stripeCustomerId });
  }

  const session = await createCheckoutSession(tenantId, plan, stripeCustomerId);

  if (!session.url) {
    throw new InternalServerError("Failed to create checkout session");
  }

  return { url: session.url, sessionId: session.id };
}

export async function confirmPlanUpgrade(tenantId: string, plan: Plan) {
  const tenant = await tenantRepo.getTenant({ id: tenantId });
  if (!tenant) {
    throw new BadRequestError("Tenant not found");
  }

  await tenantRepo.updateTenant(tenantId, { plan });

  const tenantKeys = await db()
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId));

  const pipeline = redis.client.pipeline();
  for (const key of tenantKeys) {
    pipeline.del(`key:${key.keyHash}`);
  }
  await pipeline.exec();
}
