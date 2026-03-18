import path from "node:path";
import { PrismaClient } from "@prisma/client";

function normalizeDatabaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    const sqlitePath = path.resolve(process.cwd(), "data", "news-aggregator.db").replace(/\\/g, "/");
    return `file:${sqlitePath}`;
  }

  if (trimmed.startsWith("file:")) {
    return trimmed;
  }

  const sqlitePath = path.resolve(process.cwd(), trimmed).replace(/\\/g, "/");
  return `file:${sqlitePath}`;
}

process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
