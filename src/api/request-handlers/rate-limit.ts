import * as rateLimitController from "../controllers/rate-limit";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError, NotAuthorizedError } from "../../error";
import RateLimitService from "../../services/rate-limit-service";

export interface GetRateLimitInput {
  identifier: string;
  apiKey?: string;
  endpoint?: string;
  method?: string;
  limit?: number;
  windowSeconds?: number;
  strategy?: string;
}
const getRateLimitService = (request: FastifyRequest): RateLimitService => {
  return new RateLimitService(request.server.redis);
};

export const checkRateLimit = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { key, identifier } = request.query as {
    key?: string;
    identifier?: string;
  };

  const rateLimitKey = key || `ratelimit:${identifier}`;
  const result = await rateLimitController.checkRateLimit(rateLimitKey);

  if (!result.allowed) {
    return reply.code(429).send({
      error: true,
      message: "Rate limit exceeded",
      statusCode: 429,
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      ...result,
    });
  }

  return reply.code(200).send(result);
};

export const checkRateLimitPost = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const service = getRateLimitService(request);
  const {
    identifier,
    apiKey,
    endpoint,
    method,
    limit,
    windowSeconds,
    strategy,
  } = request.body as GetRateLimitInput;

  const ipAddress =
    request.ip || (request.headers["x-forwarded-for"] as string) || "unknown";
  const userAgent = (request.headers["user-agent"] as string) || "unknown";
  const requestId = request.id;

  const result = await service.checkRateLimit({
    identifier,
    apiKey,
    endpoint,
    method,
    ipAddress,
    userAgent,
    customLimit: limit,
    customWindow: windowSeconds,
    customStrategy: strategy as
      | "token_bucket"
      | "sliding_window"
      | "leaky_bucket"
      | undefined,
    requestId,
  });

  if (!result.allowed) {
    return reply.code(429).send(result);
  }

  return reply.code(200).send(result);
};

export const batchCheckRateLimit = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const service = getRateLimitService(request);
  const { requests } = request.body as {
    requests: Array<{
      identifier: string;
      limit?: number;
      windowSeconds?: number;
      strategy?: string;
    }>;
  };

  const results = await service.checkBatchRateLimits(requests);

  return reply.code(200).send({ results });
};

export const createRule = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const data = request.body as {
    name: string;
    strategy: string;
    limit: number;
    windowMs: number;
    endpoint?: string;
    ipWhitelist?: string;
    isActive?: boolean;
    burstAllowance?: number;
  };

  const rule = await rateLimitController.createRule(userId, data);
  return reply.code(201).send(rule);
};

export const listRules = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const { limit, page, status } = request.query as {
    limit?: number;
    page?: number;
    status?: string;
  };

  const result = await rateLimitController.listRules(userId, {
    limit: limit || 20,
    page: page || 1,
    status,
  });

  return reply.code(200).send(result);
};

export const updateRule = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const { ruleId } = request.params as { ruleId: string };
  const data = request.body as {
    name?: string;
    strategy?: string;
    limit?: number;
    windowMs?: number;
    endpoint?: string;
    ipWhitelist?: string;
    isActive?: boolean;
    burstAllowance?: number;
  };

  const rule = await rateLimitController.updateRule(
    Number(ruleId),
    userId,
    data,
  );
  if (!rule) {
    throw new ResourceNotFoundError("Rule not found");
  }

  return reply.code(200).send(rule);
};

export const deleteRule = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const { ruleId } = request.params as { ruleId: string };
  const rule = await rateLimitController.deleteRule(Number(ruleId), userId);

  if (!rule) {
    throw new ResourceNotFoundError("Rule not found");
  }

  return reply.code(200).send({
    success: true,
    message: "Rule deleted successfully",
    ruleId: Number(ruleId),
  });
};

export const getQuotaStatus = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { key, strategy } = request.query as {
    key: string;
    strategy?: string;
  };

  const result = await rateLimitController.getQuotaStatus(
    key,
    strategy || "token_bucket",
  );

  return reply.code(200).send(result);
};

export const getRule = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const { ruleId } = request.params as { ruleId: string };
  const rule = await rateLimitController.getRuleById(Number(ruleId), userId);

  if (!rule) {
    throw new ResourceNotFoundError("Rule not found");
  }

  return reply.code(200).send(rule);
};

export const getQuotaForKey = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { apiKeyId } = request.params as { apiKeyId: string };
  const userId = request.user?.id;

  const result = await rateLimitController.getQuotaForApiKey(
    Number(apiKeyId),
    userId,
  );

  return reply.code(200).send(result);
};

export const updateQuotaForKey = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { apiKeyId } = request.params as { apiKeyId: string };
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const data = request.body as {
    limit?: number;
    windowSeconds?: number;
    strategy?: string;
  };

  const result = await rateLimitController.updateQuotaForApiKey(
    Number(apiKeyId),
    userId,
    data,
  );

  return reply.code(200).send(result);
};

export const swapRuleStrategy = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new NotAuthorizedError("Unauthorized");
  }

  const { ruleId } = request.params as { ruleId: string };
  const { strategy } = request.body as { strategy: string };

  const result = await rateLimitController.swapRuleStrategy(
    Number(ruleId),
    userId,
    strategy,
  );

  return reply.code(200).send(result);
};
