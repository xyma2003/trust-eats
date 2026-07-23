import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { canViewReview, isFriend, type Viewer } from "@/lib/visibility";
import { parseJsonArray, parseCuisines, type ReviewWithRestaurant } from "@/lib/types";
import { FollowButton } from "@/components/FollowButton";
import Link from "next/link";

type Params = { params: Promise<{ username: string }> };

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const user = await getSessionUser();
  const viewer: Viewer = user?.profile ? { profileId: user.profile.id } : null;

  const profile = await prisma.profile.findFirst({
    where: { username, deletedAt: null },
    include: {
      reviews: {
        where: { deletedAt: null },
        include: { restaurant: true },
        orderBy: { overall: "desc" },
      },
    },
  });

  if (!profile) notFound();

  // 按可见性过滤
  const visibleReviews: ReviewWithRestaurant[] = [];
  for (const r of profile.reviews) {
    if (await canViewReview(viewer, r)) {
      visibleReviews.push(r);
    }
  }

  const isOwner = user?.profile?.id === profile.id;

  // 查 viewer 是否 follow + 是否互关
  let isFollowing = false;
  let isFriends = false;
  if (user?.profile && !isOwner) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: user.profile.id,
          followeeId: profile.id,
        },
      },
    });
    isFollowing = !!follow;
    isFriends = await isFriend(user.profile.id, profile.id);
  }

  // 按 area 分组
  const byArea = new Map<string, ReviewWithRestaurant[]>();
  for (const r of visibleReviews) {
    const key = r.restaurant.areaCn;
    if (!byArea.has(key)) byArea.set(key, []);
    byArea.get(key)!.push(r);
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold">{profile.displayName}</h1>
              <p className="text-neutral-600">@{profile.username}</p>
            </div>
            {!isOwner && user?.profile && (
              <FollowButton
                targetUsername={profile.username}
                initialFollowing={isFollowing}
                initialFriends={isFriends}
              />
            )}
            {isOwner && (
              <div className="text-sm space-x-3">
                <Link href="/settings" className="underline">Edit</Link> ·{" "}
                <Link href="/reviews/new" className="underline">Add review</Link>
              </div>
            )}
          </div>
          {profile.bio && <p className="mt-2 text-neutral-700">{profile.bio}</p>}
          {isFriends && (
            <p className="mt-1 text-xs text-green-700">✓ You and {profile.displayName} are friends</p>
          )}
        </header>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              Reviews ({visibleReviews.length})
            </h2>
            <p className="text-sm text-neutral-500">
              Avg:{" "}
              {visibleReviews.length === 0
                ? "—"
                : (
                    visibleReviews.reduce((s, r) => s + r.overall, 0) /
                    visibleReviews.length
                  ).toFixed(1)}
            </p>
          </div>

          {visibleReviews.length === 0 ? (
            <p className="text-neutral-600 mt-2">No visible reviews.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {[...byArea.entries()].map(([area, reviews]) => (
                <div key={area}>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-2">
                    {area} · {reviews.length}
                  </h3>
                  <div className="space-y-3">
                    {reviews.map((r) => (
                      <ReviewCard key={r.id} review={r} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewCard({ review }: { review: ReviewWithRestaurant }) {
  const cuisines = parseCuisines(review.restaurant.cuisine);
  const mustOrder = parseJsonArray(review.mustOrder);
  const avoidItems = parseJsonArray(review.avoidItems);
  const otherTries = parseJsonArray(review.otherTries);
  const wantToTry = parseJsonArray(review.wantToTry);

  return (
    <article className="border rounded p-4">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold">{review.restaurant.name}</h4>
          <p className="text-sm text-neutral-600">
            {cuisines.join(" / ")}
            {review.restaurant.priceTier ? ` · ${review.restaurant.priceTier}` : ""}
            {review.lastVisited ? ` · last: ${review.lastVisited}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-semibold">{review.overall.toFixed(1)}</p>
          <p className="text-xs text-neutral-500">
            {review.visibility.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <ScoreChip label="Taste" value={review.taste} />
        {review.environment && <ScoreChip label="Env" value={review.environment} />}
        {review.service && <ScoreChip label="Svc" value={review.service} />}
        {review.value && <ScoreChip label="Value" value={review.value} />}
      </div>

      {(mustOrder.length > 0 || avoidItems.length > 0 || otherTries.length > 0 || wantToTry.length > 0) && (
        <div className="mt-3 space-y-2 text-sm">
          {mustOrder.length > 0 && (
            <DishList label="Must-order" items={mustOrder} color="text-green-700" />
          )}
          {avoidItems.length > 0 && (
            <DishList label="Avoid" items={avoidItems} color="text-red-700" />
          )}
          {otherTries.length > 0 && (
            <DishList label="Other tries" items={otherTries} color="text-neutral-700" />
          )}
          {wantToTry.length > 0 && (
            <DishList label="Want to try" items={wantToTry} color="text-blue-700" />
          )}
        </div>
      )}

      {review.notes && (
        <p className="mt-3 text-sm text-neutral-700 whitespace-pre-wrap">
          {review.notes}
        </p>
      )}
    </article>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded px-2 py-1 text-center">
      <p className="text-neutral-500">{label}</p>
      <p className="font-mono">{value.toFixed(1)}</p>
    </div>
  );
}

function DishList({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: string;
}) {
  return (
    <div>
      <p className={`text-xs uppercase ${color}`}>{label}</p>
      <ul className="list-disc list-inside ml-2">
        {items.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}

