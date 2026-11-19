import { logger } from "@/lib/logger";
import { closeRedis } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";

let isShuttingDown = false;

export async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn({ signal }, "Shutdown already in progress, forcing exit");
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");

  const shutdownTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timeout, forcing exit");
    process.exit(1);
  }, 30_000);

  try {
    logger.info("Closing Redis connection...");
    await closeRedis();
    logger.info("Redis connection closed");

    logger.info("Disconnecting Prisma...");
    await prisma.$disconnect();
    logger.info("Prisma disconnected");

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error({ err: error }, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught Exception");
  gracefulShutdown("uncaughtException");
});
