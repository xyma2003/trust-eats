import { prisma } from "./db";
import type { Viewer } from "./visibility";
import { isFriend } from "./visibility";

/**
 * 个人化聚合分算法 (TDD §4)
 *
 * 对某店 R，从 viewer X 视角的聚合分：
 *   score(X, R) = Σ (w_i × s_i) / Σ w_i
 *
 * 权重：
 *   - 直接关注 (X following) → 1.0
 *   - 朋友 (双向 follow) → 1.2（朋友比单纯关注权重略高）
 *   - 未登录或陌生人 → 不参与
 *
 * v0.1 简化：品味相似度暂不实现（需要 pgvector 或离线计算），只看关注/朋友
 * v0.2 再加品味相似度
 */

export type AggregateScoreResult = {
  score: number | null;
  reviewerCount: number;
  breakdown: Array<{
    profileId: string;
    displayName: string;
    username: string;
    weight: number;
    score: number;
    relationship: "self" | "friend" | "following";
  }>;
};

export async function computeAggregateScore(
  viewer: Viewer,
  restaurantId: string
): Promise<AggregateScoreResult> {
  // 取该店所有 PUBLIC + 未删除的 review
  const reviews = await prisma.review.findMany({
    where: {
      restaurantId,
      visibility: "PUBLIC",
      deletedAt: null,
    },
    include: {
      profile: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  if (reviews.length === 0) {
    return { score: null, reviewerCount: 0, breakdown: [] };
  }

  // 取 viewer 的关注列表
  let followingIds = new Set<string>();
  if (viewer) {
    const following = await prisma.follow.findMany({
      where: { followerId: viewer.profileId },
      select: { followeeId: true },
    });
    followingIds = new Set(following.map((f) => f.followeeId));
  }

  const breakdown: AggregateScoreResult["breakdown"] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const r of reviews) {
    let weight = 0;
    let relationship: "self" | "friend" | "following" = "following";

    if (viewer && r.profileId === viewer.profileId) {
      // 自己的评价，跳过（不计入自己看到的聚合分，避免自吹自擂 bias）
      // 或者给个低权重，v0.1 选择跳过
      continue;
    } else if (viewer && followingIds.has(r.profileId)) {
      const isFriendRel = await isFriend(viewer.profileId, r.profileId);
      if (isFriendRel) {
        weight = 1.2;
        relationship = "friend";
      } else {
        weight = 1.0;
        relationship = "following";
      }
    } else {
      // 不是关注也不是朋友：v0.1 不计入
      // 未来加品味相似度时，这里改 weight = similarity * 0.5 或类似
      continue;
    }

    breakdown.push({
      profileId: r.profileId,
      displayName: r.profile.displayName,
      username: r.profile.username,
      weight,
      score: r.overall,
      relationship,
    });
    totalWeight += weight;
    weightedSum += weight * r.overall;
  }

  if (totalWeight === 0) {
    return { score: null, reviewerCount: 0, breakdown: [] };
  }

  const score = Math.round((weightedSum / totalWeight) * 10) / 10;
  return { score, reviewerCount: breakdown.length, breakdown };
}
