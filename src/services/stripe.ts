import Stripe from "stripe";
import config from "../config/env";

const stripe = new Stripe(config.stripe.secretKey);

export async function createCheckoutSession(
  tenantId: string,
  plan: "pro" | "enterprise",
  customerId?: string,
) {
  const priceId = config.stripe.priceIds[plan];
  if (!priceId) {
    throw new Error(`No price configured for plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { tenantId, plan },
    success_url: config.stripe.successUrl,
    cancel_url: config.stripe.cancelUrl,
  });

  return session;
}

export async function createCustomer(email: string, name: string) {
  const customer = await stripe.customers.create({ email, name });
  return customer;
}

export function constructWebhookEvent(
  payload: string,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret,
  );
}

export default stripe;
