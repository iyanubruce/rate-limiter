import { trafficDb } from "../../../config/traffic-database";
import { apiKeys } from "../../../database/models/api-keys";
import { eq, and, isNull } from "drizzle-orm";

export async function findApiKey(keyHash: string) {
  return await trafficDb.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
  });
}
