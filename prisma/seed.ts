/**
 * M0: 把 hk_meal/data/restaurants.csv 导入 trust-eats DB
 *
 * 创建 1 个 seed profile (maxinyue) + 11 个 restaurant + 11 个 PUBLIC review
 *
 * 用法：npx tsx prisma/seed.ts
 *
 * 登录 seed profile:
 *   email: maxinyue@trust-eats.local
 *   password: password123
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { hashPassword } from "../lib/auth";
import { hashContent } from "../lib/review-utils";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const HK_MEAL_CSV = process.env.HK_MEAL_CSV ?? join(process.env.HOME!, "Developer/hk_meal/data/restaurants.csv");

type CsvRow = {
  slug: string;
  name: string;
  area: string;
  area_cn: string;
  cuisine: string;
  price: string;
  taste: string;
  environment: string;
  service: string;
  value: string;
  overall: string;
  last_visited: string;
  must_order: string;
  url: string;
};

async function main() {
  console.log(`Reading CSV: ${HK_MEAL_CSV}`);
  const csvContent = readFileSync(HK_MEAL_CSV, "utf-8");
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
  console.log(`Found ${rows.length} restaurants`);

  // 创建或获取 seed user + profile
  const email = "maxinyue@trust-eats.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  let userId: string;
  if (!existing) {
    const passwordHash = await hashPassword("password123");
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            username: "maxinyue",
            displayName: "Maxinyue",
            bio: "测试 trust-eats 的 seed profile，数据从 hk_meal 仓库导入",
            defaultVisibility: "PUBLIC",
          },
        },
      },
      include: { profile: true },
    });
    userId = created.id;
    console.log(`Created seed user ${created.id}, profile ${created.profile!.id}`);
  } else {
    userId = existing.id;
    console.log(`Seed user exists: ${existing.id}`);
  }
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw new Error("Profile missing for seed user");
  const profileId = profile.id;

  for (const row of rows) {
    const taste = parseFloat(row.taste);
    const env = row.environment ? parseFloat(row.environment) : undefined;
    const svc = row.service ? parseFloat(row.service) : undefined;
    const val = row.value ? parseFloat(row.value) : undefined;
    const overall = row.overall ? parseFloat(row.overall) : Math.round(taste * 10) / 10;

    const cuisines = row.cuisine.split(";").filter(Boolean);
    const mustOrder = row.must_order ? row.must_order.split(";").filter(Boolean) : [];

    // 创建 restaurant（如果不存在）
    const existing = await prisma.restaurant.findFirst({
      where: { name: row.name, area: row.area },
    });
    let restaurant = existing;
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: row.name,
          area: row.area,
          areaCn: row.area_cn,
          cuisine: JSON.stringify(cuisines),
          priceTier: row.price || null,
          url: row.url || null,
          createdById: profileId,
        },
      });
    }

    // 检查是否已 review
    const existingReview = await prisma.review.findFirst({
      where: { profileId, restaurantId: restaurant.id, deletedAt: null },
    });
    if (existingReview) {
      console.log(`  ✓ ${row.name} (already reviewed, skip)`);
      continue;
    }

    const contentHash = hashContent({
      profileId,
      restaurantId: restaurant.id,
      taste,
      overall,
      notes: "",
    });

    await prisma.review.create({
      data: {
        profileId,
        restaurantId: restaurant.id,
        taste,
        environment: env,
        service: svc,
        value: val,
        overall,
        mustOrder: JSON.stringify(mustOrder),
        avoidItems: JSON.stringify([]),
        otherTries: JSON.stringify([]),
        wantToTry: JSON.stringify([]),
        notes: "",
        visibility: "PUBLIC",
        photoUrls: JSON.stringify([]),
        contentHash,
        lastVisited: row.last_visited || null,
      },
    });
    console.log(`  ✓ ${row.name} (${row.area_cn}, overall ${overall})`);
  }

  console.log("\nSeed done. Login:");
  console.log("  email: maxinyue@trust-eats.local");
  console.log("  password: password123");
  console.log("  profile: http://localhost:3000/maxinyue");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
