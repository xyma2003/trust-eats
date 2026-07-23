import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { parseJsonArray, parseCuisines } from "@/lib/types";

// GET /api/export/year?year=2025
// 返回该年的 review 数据，前端用来生成年报图
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yearStr = req.nextUrl.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  if (isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  // 取该用户当年创建的所有 review（包括已撤回的，因为撤回留痕也要算进年报）
  // 但展示时标"已撤回"
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const reviews = await prisma.review.findMany({
    where: {
      profileId: user.profile.id,
      createdAt: { gte: startDate, lt: endDate },
    },
    include: { restaurant: true },
    orderBy: { createdAt: "asc" },
  });

  // 统计
  const totalReviews = reviews.length;
  const activeReviews = reviews.filter((r) => !r.deletedAt);
  const avgScore =
    activeReviews.length > 0
      ? activeReviews.reduce((s, r) => s + r.overall, 0) / activeReviews.length
      : 0;

  // 按地区
  const byArea = new Map<string, number>();
  for (const r of reviews) {
    const area = r.restaurant.areaCn;
    byArea.set(area, (byArea.get(area) || 0) + 1);
  }

  // 按菜系
  const byCuisine = new Map<string, number>();
  for (const r of reviews) {
    const cuisines = parseCuisines(r.restaurant.cuisine);
    for (const c of cuisines) {
      byCuisine.set(c, (byCuisine.get(c) || 0) + 1);
    }
  }

  // 最高分 / 最低分店
  const sortedByScore = [...activeReviews].sort((a, b) => b.overall - a.overall);
  const top = sortedByScore[0];
  const bottom = sortedByScore[sortedByScore.length - 1];

  // 按月分布
  const byMonth = new Array(12).fill(0);
  for (const r of reviews) {
    byMonth[r.createdAt.getMonth()]++;
  }

  // 全部店列表
  const places = reviews.map((r) => ({
    name: r.restaurant.name,
    areaCn: r.restaurant.areaCn,
    cuisines: parseCuisines(r.restaurant.cuisine),
    overall: r.overall,
    taste: r.taste,
    lastVisited: r.lastVisited,
    mustOrder: parseJsonArray(r.mustOrder),
    revoked: !!r.deletedAt,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({
    profile: {
      username: user.profile.username,
      displayName: user.profile.displayName,
    },
    year,
    stats: {
      totalReviews,
      activeReviews: activeReviews.length,
      revokedReviews: totalReviews - activeReviews.length,
      avgScore: Math.round(avgScore * 10) / 10,
      distinctAreas: byArea.size,
      distinctCuisines: byCuisine.size,
    },
    byArea: [...byArea.entries()].sort((a, b) => b[1] - a[1]),
    byCuisine: [...byCuisine.entries()].sort((a, b) => b[1] - a[1]),
    byMonth,
    top: top
      ? {
          name: top.restaurant.name,
          areaCn: top.restaurant.areaCn,
          overall: top.overall,
          mustOrder: parseJsonArray(top.mustOrder),
        }
      : null,
    bottom: bottom
      ? {
          name: bottom.restaurant.name,
          areaCn: bottom.restaurant.areaCn,
          overall: bottom.overall,
        }
      : null,
    places,
  });
}
