import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  // 拿 friend1 profile 和 maxinyue profile
  const friend = await prisma.profile.findUnique({ where: { username: "friend1" } });
  const maxinyue = await prisma.profile.findUnique({ where: { username: "maxinyue" } });
  if (!friend || !maxinyue) {
    console.log("Both profiles must exist");
    return;
  }

  // 让 friend1 follow maxinyue（单向）
  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followeeId: { followerId: friend.id, followeeId: maxinyue.id },
    },
  });
  if (!existing) {
    await prisma.follow.create({
      data: { followerId: friend.id, followeeId: maxinyue.id },
    });
    console.log("friend1 -> maxinyue (单向 follow) created");
  } else {
    console.log("friend1 -> maxinyue already exists");
  }

  // 算 maxinyue 写的亚参海南鸡饭的聚合分（从 friend1 视角）
  // friend1 follow maxinyue（但不是互关，所以不是 friend，是 following）
  // 权重应该是 1.0
  const yasan = await prisma.restaurant.findFirst({ where: { name: "亚参海南鸡饭" } });
  if (!yasan) {
    console.log("亚参 not found");
    return;
  }

  const { computeAggregateScore } = await import("../lib/scoring");
  const result = await computeAggregateScore({ profileId: friend.id }, yasan.id);
  console.log("Aggregate score (friend1 view of 亚参):", JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
