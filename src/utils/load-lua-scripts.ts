import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Get directory of THIS file reliably
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const luaDirPath = join(__dirname, "..", "lua");

export async function loadLuaScript(filename: string): Promise<string> {
  const fullPath = join(luaDirPath, filename);

  const file = Bun.file(fullPath);

  const exists = await file.exists();

  if (!exists) {
    throw new Error(
      `Bun.file says no: ${fullPath}\n` +
        `CWD: ${process.cwd()}\n` +
        `Module dir: ${__dirname}`,
    );
  }

  return await file.text();
}
export async function loadAllLuaScripts(): Promise<Record<string, string>> {
  const rateLimitScript = await loadLuaScript("rate-limit.lua");
  const tokenBucketScript = await loadLuaScript("token-bucket.lua");
  const slidingWindowScript = await loadLuaScript("sliding-window.lua");
  const leakyBucketScript = await loadLuaScript("leaky-bucket.lua");
  return {
    rateLimit: rateLimitScript,
    tokenBucket: tokenBucketScript,
    slidingWindow: slidingWindowScript,
    leakyBucket: leakyBucketScript,
  };
}
