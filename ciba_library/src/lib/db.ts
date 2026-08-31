import "server-only";
import { PrismaClient } from "@prisma/client";

/*
 * PrismaClient singleton. Next.js dev (and HMR) re-evaluates modules often; a
 * fresh client per reload exhausts the DB connection pool. Stashing one on the
 * global keeps a single instance across reloads. In production a normal module
 * singleton is enough.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
