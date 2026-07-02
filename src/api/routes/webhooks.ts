import type { FastifyPluginAsync } from "fastify";
import { confirmPlanUpgrade, type Plan } from "../controllers/tenants";
import { constructWebhookEvent } from "../../services/stripe";
import { BadRequestError, InternalServerError } from "../../error";
import logger from "../../utils/logger";

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preParsing", (request, _reply, payload, done) => {
    const chunks: Buffer[] = [];
    payload.on("data", (chunk: Buffer) => chunks.push(chunk));
    payload.on("end", () => {
      (request as any).rawBody = Buffer.concat(chunks).toString("utf8");
      done();
    });
    payload.on("error", (err) => done(err));
  });

  fastify.post("/stripe", async (request, reply) => {
    try {
      const sig = request.headers["stripe-signature"] as string;
      if (!sig) {
        throw new BadRequestError("Missing stripe-signature header");
      }

      const rawBody = (request as any).rawBody;
      if (!rawBody) {
        throw new BadRequestError("Missing request body");
      }

      let event: any;
      try {
        event = constructWebhookEvent(rawBody, sig);
      } catch {
        return reply.code(401).send({ error: "Invalid signature" });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { tenantId, plan } = session.metadata || {};

        if (tenantId && plan) {
          await confirmPlanUpgrade(tenantId, plan as Plan);
          logger.info(`Tenant ${tenantId} upgraded to ${plan}`);
        }
      }

      return reply.code(200).send({ received: true });
    } catch (error) {
      logger.error("Webhook error:", error);
      throw new InternalServerError("Webhook processing failed");
    }
  });
};

export default webhookRoutes;
