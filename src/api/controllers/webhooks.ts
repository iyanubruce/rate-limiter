import WebhookRepository from "../../database/repositories/webhooks";
import { db } from "../../config/database";
import { ResourceNotFoundError, BadRequestError } from "../../error";
import type { WebhookInsert } from "../../database/models/alerts";

const webhookRepo = new WebhookRepository(db());

export const createWebhook = async (
  userId: number,
  data: {
    url: string;
    events: string[];
    secret?: string | null;
    isActive?: boolean;
    headers?: Record<string, string> | null;
  },
) => {
  const payload: WebhookInsert = {
    userId,
    url: data.url,
    events: data.events,
    secret: data.secret ?? null,
    isActive: data.isActive ?? true,
    headers: data.headers ?? null,
  };

  const webhook = await webhookRepo.create(payload);
  return webhook;
};

export const listWebhooks = async (userId: number) => {
  return webhookRepo.findAllByUserId(userId);
};

export const getWebhook = async (userId: number, webhookId: number) => {
  const webhook = await webhookRepo.findById(webhookId);
  if (!webhook || webhook.userId !== userId) {
    throw new ResourceNotFoundError("Webhook not found");
  }
  return webhook;
};

export const updateWebhook = async (
  userId: number,
  webhookId: number,
  data: {
    url?: string;
    events?: string[];
    secret?: string | null;
    isActive?: boolean;
    headers?: Record<string, string> | null;
  },
) => {
  const existing = await webhookRepo.findById(webhookId);
  if (!existing || existing.userId !== userId) {
    throw new ResourceNotFoundError("Webhook not found");
  }

  const updated = await webhookRepo.update(webhookId, data);
  if (!updated) {
    throw new ResourceNotFoundError("Webhook not found");
  }
  return updated;
};

export const deleteWebhook = async (userId: number, webhookId: number) => {
  const existing = await webhookRepo.findById(webhookId);
  if (!existing || existing.userId !== userId) {
    throw new ResourceNotFoundError("Webhook not found");
  }

  const deleted = await webhookRepo.delete(webhookId);
  if (!deleted) {
    throw new ResourceNotFoundError("Webhook not found");
  }
};
