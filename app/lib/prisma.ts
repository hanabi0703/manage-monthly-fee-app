import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(
  /^file:/,
  "",
);

const adapter = new PrismaBetterSqlite3({
  url: `file:${path.resolve(process.cwd(), dbPath)}`,
});

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
