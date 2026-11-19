import { describe, it, expect, vi, beforeEach } from "vitest";
import { cekRateLimiter, resetRateLimit } from "@/lib/rate-limit";
import redis from "@/lib/redis";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.incr).mockReset();
    vi.mocked(redis.expire).mockReset();
    vi.mocked(redis.ttl).mockReset();
    vi.mocked(redis.ping).mockReset();
    vi.mocked(redis.scan).mockReset();
    vi.mocked(redis.del).mockReset();
    vi.mocked(redis.quit).mockReset();
    vi.mocked(redis.connect).mockReset();
    (redis as any).status = "ready";
  });

  it("mengizinkan request pertama", async () => {
    vi.mocked(redis.incr).mockResolvedValue(1);
    vi.mocked(redis.ttl).mockResolvedValue(900);

    const result = await cekRateLimiter("test-key");

    expect(result.ok).toBe(true);
    expect(result.tersisa).toBe(4);
  });

  it("memblokir setelah melebihi batas", async () => {
    vi.mocked(redis.incr).mockResolvedValue(6);
    vi.mocked(redis.ttl).mockResolvedValue(600);

    const result = await cekRateLimiter("test-key");

    expect(result.ok).toBe(false);
    expect(result.cobaLagiDalamDetik).toBe(600);
    expect(result.tersisa).toBe(0);
  });

  it("resetRateLimit memanggil scan dan del", async () => {
    vi.mocked(redis.scan)
      .mockResolvedValueOnce(["0", ["rl:test:*"]])
      .mockResolvedValueOnce(["0", []]);
    vi.mocked(redis.del).mockResolvedValue(1);

    await resetRateLimit("test");

    expect(redis.scan).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled();
  });
});
