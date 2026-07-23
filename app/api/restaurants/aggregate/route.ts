import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { computeAggregateScore } from "@/lib/scoring";

// GET /api/restaurants/aggregate?ids=id1,id2,id3
// 批量取多个店的聚合分（用于列表页一次查多店）
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ scores: {} });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: "Max 50 ids per call" }, { status: 400 });
  }

  const user = await getSessionUser();
  const viewer = user?.profile ? { profileId: user.profile.id } : null;

  const scores: Record<string, Awaited<ReturnType<typeof computeAggregateScore>>> = {};
  await Promise.all(
    ids.map(async (id) => {
      scores[id] = await computeAggregateScore(viewer, id);
    })
  );

  return NextResponse.json({ scores });
}
