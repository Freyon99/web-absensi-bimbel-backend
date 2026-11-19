import redis from "@/lib/redis";
import { WINDOW_MS, MAKS_PER_WINDOW } from "./rate-limit-constants";

let connected = false;
async function ensureConnected() {
  if (!connected) {
    await redis.connect();
    connected = true;
  }
}

export interface RateLimitResult {
  ok: boolean;
  cobaLagiDalamDetik: number;
  tersisa: number;
  resetAt: number;
}

/** Rate limit terdistribusi via Redis (Upstash/Valkey/Redis). */
export async function cekRateLimiter(kunci: string): Promise<RateLimitResult> {
  await ensureConnected();

  const windowSec = Math.ceil(WINDOW_MS / 1000);
  const windowId = Math.floor(Date.now() / WINDOW_MS);
  const key = `rl:${kunci}:${windowId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSec);
  }

  const ttl = await redis.ttl(key);
  const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : WINDOW_MS);
  const tersisa = Math.max(MAKS_PER_WINDOW - current, 0);

  if (current > MAKS_PER_WINDOW) {
    return {
      ok: false,
      cobaLagiDalamDetik: ttl > 0 ? ttl : windowSec,
      tersisa: 0,
      resetAt,
    };
  }

  return { ok: true, cobaLagiDalamDetik: 0, tersisa, resetAt };
}

/** Hapus semua entry rate limit untuk testing/debug. */
export async function resetRateLimit(kunci: string): Promise<void> {
  await ensureConnected();
  const pattern = `rl:${kunci}:*`;
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== "0");
}

export async function closeRedis(): Promise<void> {
  if (connected) {
    await redis.quit();
    connected = false;
  }
}
