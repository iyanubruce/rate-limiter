import type { FastifyPluginAsync } from "fastify";
import { validateAccessToken } from "../middleware/validate-access-token";
import * as analyticsHandler from "../request-handlers/analytics";
import {
  analyticsOverviewSchema,
  analyticsEventsSchema,
  analyticsTimeseriesSchema,
  analyticsTopBlockedSchema,
  analyticsPatternsSchema,
  analyticsEndpointsSchema,
  analyticsStatusCodesSchema,
  analyticsIpAddressesSchema,
} from "../validations/analytics";

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", validateAccessToken);

  fastify.get(
    "/overview",
    { schema: analyticsOverviewSchema },
    analyticsHandler.analyticsOverview,
  );

  fastify.get(
    "/events",
    { schema: analyticsEventsSchema },
    analyticsHandler.analyticsEvents,
  );

  fastify.get(
    "/timeseries",
    { schema: analyticsTimeseriesSchema },
    analyticsHandler.analyticsTimeseries,
  );

  fastify.get(
    "/top-blocked",
    { schema: analyticsTopBlockedSchema },
    analyticsHandler.analyticsTopBlocked,
  );

  fastify.get(
    "/patterns",
    { schema: analyticsPatternsSchema },
    analyticsHandler.analyticsPatterns,
  );

  fastify.get(
    "/endpoints",
    { schema: analyticsEndpointsSchema },
    analyticsHandler.analyticsEndpoints,
  );

  fastify.get(
    "/status-codes",
    { schema: analyticsStatusCodesSchema },
    analyticsHandler.analyticsStatusCodes,
  );

  fastify.get(
    "/ip-addresses",
    { schema: analyticsIpAddressesSchema },
    analyticsHandler.analyticsIpAddresses,
  );
};

export default analyticsRoutes;
