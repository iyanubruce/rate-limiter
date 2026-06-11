import type { FastifyReply, FastifyRequest } from "fastify";
import { ResourceNotFoundError } from "../../error";
import * as analyticsController from "../controllers/analytics";
import type {
  GetAnalyticsEventInput,
  GetTimeseriesInput,
  GetTopBlockedInput,
  GetEndpointsInput,
  GetIpAddressesInput,
} from "../../interfaces/analytics";

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.user?.tenantId;
  if (!tenantId) {
    throw new ResourceNotFoundError("Tenant not found");
  }
  return tenantId;
}

export async function analyticsOverview(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { startDate, endDate } = request.query as {
    startDate?: string;
    endDate?: string;
  };

  const data = await analyticsController.analyticsOverview(
    getTenantId(request),
    startDate,
    endDate,
  );
  return reply.code(200).send(data);
}

export async function analyticsEvents(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = request.query as GetAnalyticsEventInput;
  const data = await analyticsController.analyticsEvents(
    getTenantId(request),
    input,
  );
  return reply.code(200).send(data);
}

export async function analyticsTimeseries(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = request.query as GetTimeseriesInput;
  const data = await analyticsController.analyticsTimeseries(
    getTenantId(request),
    input,
  );
  return reply.code(200).send(data);
}

export async function analyticsTopBlocked(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = request.query as GetTopBlockedInput;
  const data = await analyticsController.analyticsTopBlocked(
    getTenantId(request),
    input,
  );
  return reply.code(200).send(data);
}

export async function analyticsPatterns(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { startDate, endDate } = request.query as {
    startDate?: string;
    endDate?: string;
  };

  const data = await analyticsController.analyticsPatterns(
    getTenantId(request),
    startDate,
    endDate,
  );
  return reply.code(200).send(data);
}

export async function analyticsEndpoints(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = request.query as GetEndpointsInput;
  const data = await analyticsController.analyticsEndpoints(
    getTenantId(request),
    input,
  );
  return reply.code(200).send(data);
}

export async function analyticsStatusCodes(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { startDate, endDate } = request.query as {
    startDate?: string;
    endDate?: string;
  };

  const data = await analyticsController.analyticsStatusCodes(
    getTenantId(request),
    startDate,
    endDate,
  );
  return reply.code(200).send(data);
}

export async function analyticsIpAddresses(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = request.query as GetIpAddressesInput;
  const data = await analyticsController.analyticsIpAddresses(
    getTenantId(request),
    input,
  );
  return reply.code(200).send(data);
}
