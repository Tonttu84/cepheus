import { PrismaClient } from "@prisma/client";
import { getEnv } from "@/server/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let localPrisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma ?? localPrisma;
  if (existing) {
    return existing;
  }

  const env = getEnv();
  const client = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  localPrisma = client;
  return client;
}
