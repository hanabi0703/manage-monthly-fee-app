import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";

const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(
  /^file:/,
  "",
);
const adapter = new PrismaBetterSqlite3({
  url: `file:${path.resolve(process.cwd(), dbPath)}`,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.feeSetting.findFirst();
  if (!existing) {
    await prisma.feeSetting.create({
      data: {
        amount: 5000,
        effectiveFrom: new Date(),
      },
    });
    console.log("Created default fee setting: 5000 yen");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
