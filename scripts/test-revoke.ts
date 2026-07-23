import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  // 找 maxinyue 对亚参的 review
  const review = await prisma.review.findFirst({
    where: {
      profile: { username: "maxinyue" },
      restaurant: { name: "亚参海南鸡饭" },
      deletedAt: null,
    },
  });
  if (!review) {
    console.log("No active review found");
    return;
  }
  console.log("Review ID:", review.id, "overall:", review.overall);

  // 撤回
  await prisma.review.update({
    where: { id: review.id },
    data: { deletedAt: new Date(), isRevoked: true },
  });
  console.log("✓ Revoked");

  // 再查聚合分
  const { computeAggregateScore } = await import("../lib/scoring");
  const friend = await prisma.profile.findUnique({ where: { username: "friend1" } });
  const result = await computeAggregateScore(
    { profileId: friend!.id },
    review.restaurantId
  );
  console.log("Aggregate after revoke:", JSON.stringify(result, null, 2));

  // 恢复（重新激活）
  await prisma.review.update({
    where: { id: review.id },
    data: { deletedAt: null, isRevoked: false },
  });
  console.log("✓ Restored");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
