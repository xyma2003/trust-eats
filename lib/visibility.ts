import { prisma } from "./db";

export type Visibility = "PRIVATE" | "FRIENDS" | "PUBLIC";

export function parseVisibility(s: string | null | undefined): Visibility {
  if (s === "PRIVATE" || s === "FRIENDS" || s === "PUBLIC") return s;
  return "PRIVATE";
}

/**
 * Viewer 的身份：profileId 是 Profile 表的 id（不是 User 表的 id）
 * 这是评论作者的标识维度
 */
export type Viewer = { profileId: string } | null;

/**
 * 朋友关系：A 和 B 互相关注（双向 follow）
 * aId / bId 都是 Profile.id
 */
export async function isFriend(aId: string, bId: string): Promise<boolean> {
  if (aId === bId) return true;
  const [ab, ba] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: aId, followeeId: bId } },
    }),
    prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: bId, followeeId: aId } },
    }),
  ]);
  return !!ab && !!ba;
}

/**
 * 某个 viewer 能否看到某条 review
 * - PRIVATE：仅作者
 * - FRIENDS：作者 + 双向朋友
 * - PUBLIC：任何人
 */
export async function canViewReview(
  viewer: Viewer,
  review: { profileId: string; visibility: string }
): Promise<boolean> {
  if (viewer?.profileId === review.profileId) return true;
  const vis = parseVisibility(review.visibility);
  switch (vis) {
    case "PRIVATE":
      return false;
    case "FRIENDS":
      return viewer ? await isFriend(viewer.profileId, review.profileId) : false;
    case "PUBLIC":
      return true;
  }
}

