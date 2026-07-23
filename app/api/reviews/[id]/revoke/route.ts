import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// POST /api/reviews/:id/revoke - 撤回（软删 + 留痕）
// TDD §5.2: 评价从 profile / 聚合分消失，但留痕记录保留
//  - deletedAt = now, isRevoked = true
//  - 用户自己仍可见自己的撤回历史（未来功能）
//  - 商家可验证"曾存在过评价"（未来区块链承诺层用）
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (review.profileId !== user.profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (review.deletedAt) {
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  await prisma.review.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isRevoked: true,
    },
  });

  return NextResponse.json({ ok: true, revoked: true });
}
