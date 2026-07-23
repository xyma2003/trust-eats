import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { computeAggregateScore } from "@/lib/scoring";
import { canViewReview } from "@/lib/visibility";
import { parseJsonArray, parseCuisines } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// GET /api/restaurants/:id - 店详情 + 个人化聚合分 + 可见的评价列表
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  const viewer = user?.profile ? { profileId: user.profile.id } : null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      reviews: {
        where: { deletedAt: null },
        include: {
          profile: { select: { id: true, username: true, displayName: true } },
        },
        orderBy: { overall: "desc" },
      },
    },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 过滤可见 review
  const visibleReviews = [];
  for (const r of restaurant.reviews) {
    if (await canViewReview(viewer, r)) {
      visibleReviews.push({
        id: r.id,
        overall: r.overall,
        taste: r.taste,
        environment: r.environment,
        service: r.service,
        value: r.value,
        notes: r.notes,
        lastVisited: r.lastVisited,
        mustOrder: parseJsonArray(r.mustOrder),
        avoidItems: parseJsonArray(r.avoidItems),
        otherTries: parseJsonArray(r.otherTries),
        wantToTry: parseJsonArray(r.wantToTry),
        visibility: r.visibility,
        createdAt: r.createdAt,
        profile: r.profile,
      });
    }
  }

  // 聚合分
  const aggregate = await computeAggregateScore(viewer, id);

  return NextResponse.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      nameEn: restaurant.nameEn,
      area: restaurant.area,
      areaCn: restaurant.areaCn,
      address: restaurant.address,
      phone: restaurant.phone,
      cuisine: parseCuisines(restaurant.cuisine),
      priceTier: restaurant.priceTier,
      url: restaurant.url,
    },
    visibleReviews,
    aggregate,
  });
}
