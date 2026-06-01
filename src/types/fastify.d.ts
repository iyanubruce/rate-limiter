import type { User } from "../database/models/user";
import type { ApiKey } from "../database/models/api-keys";
import type RedisClient from "../services/redis";
import type { DatabaseClient } from "../config/database";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    apiKey?: ApiKey;
  }

  interface FastifyInstance {
    redis: RedisClient;
    dbClient: DatabaseClient;
  }
}
