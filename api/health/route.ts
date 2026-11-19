import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

interface HealthResponse {
  timestamp: string;
  uptime: number;
  version: string;
  status: "healthy" | "degraded";
  checks: {
    database: boolean;
    redis: boolean;
  };
}

export async function GET(req: NextRequest) {
  const response: HealthResponse = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? "unknown",
    status: "degraded",
    checks: {
      database: false,
      redis: false,
    },
  };

  let status = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    response.checks.database = true;
  } catch {
    response.checks.database = false;
    status = 503;
  }

  try {
    if (redis.status === "ready" || redis.status === "wait") {
      await redis.ping();
      response.checks.redis = true;
    } else {
      response.checks.redis = false;
    }
  } catch {
    response.checks.redis = false;
    status = 503;
  }

  const allHealthy = Object.values(response.checks).every(Boolean);
  response.status = allHealthy ? "healthy" : "degraded";

  return NextResponse.json(response, { status });
}
