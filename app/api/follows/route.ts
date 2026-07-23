import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isFriend } from "@/lib/visibility";

const FollowSchema = z.object({
  followeeUsername: z.string().min(1),
});

// POST /api/follows - follow 某 profile
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = FollowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const followee = await prisma.profile.findFirst({
    where: { username: parsed.data.followeeUsername, deletedAt: null },
  });
  if (!followee) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (followee.id === user.profile.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  // 检查是否已 follow
  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followeeId: {
        followerId: user.profile.id,
        followeeId: followee.id,
      },
    },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyFollowing: true });
  }

  await prisma.follow.create({
    data: { followerId: user.profile.id, followeeId: followee.id },
  });

  const nowFriends = await isFriend(user.profile.id, followee.id);

  return NextResponse.json({ ok: true, following: true, nowFriends });
}

// GET /api/follows?username=xxx - 查某人的 followers / following
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  const list = req.nextUrl.searchParams.get("list") ?? "following";
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }
  const profile = await prisma.profile.findFirst({
    where: { username, deletedAt: null },
  });
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (list === "followers") {
    const rows = await prisma.follow.findMany({
      where: { followeeId: profile.id },
      include: { follower: { select: { id: true, username: true, displayName: true } } },
    });
    return NextResponse.json({
      list: rows.map((r) => r.follower),
    });
  } else {
    const rows = await prisma.follow.findMany({
      where: { followerId: profile.id },
      include: { followee: { select: { id: true, username: true, displayName: true } } },
    });
    return NextResponse.json({
      list: rows.map((r) => r.followee),
    });
  }
}
