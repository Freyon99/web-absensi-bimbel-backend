import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);

export default defineConfig({
  // @ts-expect-error - Prisma 7.x config type incomplete, adapter works at runtime
  adapter,
});
