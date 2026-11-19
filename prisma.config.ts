import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL!;
const adapter = new PrismaPg(databaseUrl);

export default defineConfig({
  // @ts-expect-error - Prisma 7.x config type incomplete
  adapter,
  datasource: {
    url: databaseUrl,
  },
});
