import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// DELETE /api/profiles/me - 删除整个 profile（软删）
// TDD §5.1: 所有 review 软删 + profile 软删，30 天后定期硬删
//   - profile.deletedAt = now
//   - reviews.deletedAt = now (所有该 profile 的 review)
//   - follows 保留（让 follow 关系断开）
// v0.1 简化：不实现定期硬删 cron，只软删
export async function DELETE() {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 事务：reviews 软删 + profile 软删 + user 删除（切断登录路径）
  await prisma.$transaction([
    prisma.review.updateMany({
      where: { profileId: user.profile.id, deletedAt: null },
      data: { deletedAt: now, isRevoked: true },
    }),
    prisma.listItem.updateMany({
      where: { list: { profileId: user.profile.id } },
      data: { reviewId: null },
    }),
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: user.profile.id }, { followeeId: user.profile.id }] },
    }),
    prisma.profile.update({
      where: { id: user.profile.id },
      data: { deletedAt: now },
    }),
  ]);

  // User 表也删（用户不能再用该账号登录）
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ ok: true });
}
