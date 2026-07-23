import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { computeAggregateScore } from "@/lib/scoring";
import { canViewReview } from "@/lib/visibility";
import { parseJsonArray, parseCuisines } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export default async function RestaurantDetailPage({ params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  const viewer = user?.profile ? { profileId: user.profile.id } : null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      reviews: {
        where: { deletedAt: null },
        include: { profile: { select: { id: true, username: true, displayName: true } } },
        orderBy: { overall: "desc" },
      },
    },
  });

  if (!restaurant) notFound();

  // 过滤可见 review
  const visibleReviews = [];
  for (const r of restaurant.reviews) {
    if (await canViewReview(viewer, r)) {
      visibleReviews.push(r);
    }
  }

  const aggregate = await computeAggregateScore(viewer, id);
  const cuisines = parseCuisines(restaurant.cuisine);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <p className="text-sm">
            <Link href="/restaurants" className="underline">← All restaurants</Link>
          </p>
          <h1 className="text-2xl font-bold mt-2">{restaurant.name}</h1>
          <p className="text-neutral-600">
            {restaurant.areaCn} · {cuisines.join(" / ")}
            {restaurant.priceTier ? ` · ${restaurant.priceTier}` : ""}
          </p>
          {restaurant.address && (
            <p className="text-sm text-neutral-600 mt-1">{restaurant.address}</p>
          )}
          {restaurant.phone && (
            <p className="text-sm text-neutral-600">{restaurant.phone}</p>
          )}
          {restaurant.url && (
            <p className="text-sm mt-1">
              <a href={restaurant.url} target="_blank" rel="noreferrer" className="underline">
                OpenRice / 官网 →
              </a>
            </p>
          )}
        </header>

        <section className="border rounded p-4">
          <h2 className="text-sm font-semibold text-neutral-700">Your personalized score</h2>
          <div className="mt-2 flex items-baseline gap-3">
            {aggregate.score !== null ? (
              <>
                <p className="text-4xl font-mono font-bold">
                  {aggregate.score.toFixed(1)}
                </p>
                <p className="text-sm text-neutral-500">
                  from {aggregate.reviewerCount}{" "}
                  {aggregate.reviewerCount === 1 ? "person" : "people"} you follow
                </p>
              </>
            ) : (
              <p className="text-neutral-500">
                {user
                  ? "No reviews from people you follow yet."
                  : "Log in to see personalized score based on who you follow."}
              </p>
            )}
          </div>

          {aggregate.breakdown.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {aggregate.breakdown.map((b) => (
                <li key={b.profileId} className="flex justify-between">
                  <span>
                    <Link href={`/${b.username}`} className="underline">
                      {b.displayName}
                    </Link>{" "}
                    <span className="text-xs text-neutral-500">
                      ({b.relationship})
                    </span>
                  </span>
                  <span className="font-mono">{b.score.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">
            Reviews ({visibleReviews.length})
          </h2>
          {visibleReviews.length === 0 ? (
            <p className="text-neutral-600">No visible reviews.</p>
          ) : (
            <div className="space-y-3">
              {visibleReviews.map((r) => (
                <ReviewBlock key={r.id} review={r} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewBlock({ review }: { review: any }) {
  const mustOrder = parseJsonArray(review.mustOrder);
  const avoidItems = parseJsonArray(review.avoidItems);
  const otherTries = parseJsonArray(review.otherTries);
  const wantToTry = parseJsonArray(review.wantToTry);

  return (
    <article className="border rounded p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">
            <Link href={`/${review.profile.username}`} className="underline">
              {review.profile.displayName}
            </Link>
          </p>
          <p className="text-xs text-neutral-500">
            @{review.profile.username} · {review.lastVisited || "—"}
          </p>
        </div>
        <p className="text-2xl font-mono font-semibold">{review.overall.toFixed(1)}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Score label="Taste" value={review.taste} />
        {review.environment && <Score label="Env" value={review.environment} />}
        {review.service && <Score label="Svc" value={review.service} />}
        {review.value && <Score label="Value" value={review.value} />}
      </div>

      {(mustOrder.length > 0 || avoidItems.length > 0 || otherTries.length > 0 || wantToTry.length > 0) && (
        <div className="mt-3 space-y-2 text-sm">
          {mustOrder.length > 0 && (
            <Dishes label="Must-order" items={mustOrder} color="text-green-700" />
          )}
          {avoidItems.length > 0 && (
            <Dishes label="Avoid" items={avoidItems} color="text-red-700" />
          )}
          {otherTries.length > 0 && (
            <Dishes label="Other tries" items={otherTries} color="text-neutral-700" />
          )}
          {wantToTry.length > 0 && (
            <Dishes label="Want to try" items={wantToTry} color="text-blue-700" />
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

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded px-2 py-1 text-center">
      <p className="text-neutral-500">{label}</p>
      <p className="font-mono">{value.toFixed(1)}</p>
    </div>
  );
}

function Dishes({
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
