import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type Params = { params: Promise<{ followeeUsername: string }> };

// DELETE /api/follows/:followeeUsername - unfollow
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { followeeUsername } = await params;

  const followee = await prisma.profile.findFirst({
    where: { username: followeeUsername, deletedAt: null },
  });
  if (!followee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.follow.deleteMany({
    where: {
      followerId: user.profile.id,
      followeeId: followee.id,
    },
  });

  return NextResponse.json({ ok: true });
}
