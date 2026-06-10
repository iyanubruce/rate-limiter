import { customAlphabet } from "nanoid";

// 1. Define a clean, URL-safe alphanumeric alphabet (62 characters total)
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// 2. Instantiate a custom size generator enforcing 21 random characters
const generateNano = customAlphabet(alphabet, 21);

/**
 * Generates a collision-resistant, human-readable Multi-Tenant Organization ID
 * Example Output: "org_7FzK9wR2bN5x3M9pL1vQx"
 */
export const generateTenantId = (): string => {
  return `org_${generateNano()}`;
};
