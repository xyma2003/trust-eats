import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { computeAggregateScore } from "@/lib/scoring";
import { parseCuisines } from "@/lib/types";

// GET /api/restaurants/search?q=xxx
// 返回搜索结果 + 每店的聚合分（个人化）
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const area = req.nextUrl.searchParams.get("area")?.trim() ?? "";

  if (q.length < 1 && area.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [{ name: { contains: q } }, { nameEn: { contains: q } }];
  }
  if (area) {
    where.area = area;
  }

  const results = await prisma.restaurant.findMany({
    where,
    take: 20,
    orderBy: { name: "asc" },
  });

  const user = await getSessionUser();
  const viewer = user?.profile ? { profileId: user.profile.id } : null;

  // 批量算聚合分
  const withScores = await Promise.all(
    results.map(async (r) => {
      const aggregate = await computeAggregateScore(viewer, r.id);
      return {
        id: r.id,
        name: r.name,
        nameEn: r.nameEn,
        area: r.area,
        areaCn: r.areaCn,
        cuisine: parseCuisines(r.cuisine),
        priceTier: r.priceTier,
        aggregate,
      };
    })
  );

  return NextResponse.json({ results: withScores });
}
