import { vi } from "vitest";

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  ping: vi.fn(),
  scan: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
  connect: vi.fn(),
  status: "ready",
  on: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  default: {
    pengguna: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  default: mockRedis,
}));
