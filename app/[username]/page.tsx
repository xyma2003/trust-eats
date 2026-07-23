import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { canViewReview } from "@/lib/visibility";

type Params = { params: Promise<{ username: string }> };

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const viewer = await getSessionUser();

  const profile = await prisma.profile.findUnique({
    where: { username, deletedAt: null },
    include: {
      reviews: {
        where: { deletedAt: null },
        include: { restaurant: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profile || profile.deletedAt) notFound();

  // 过滤可见的 review
  const visibleReviews = [];
  for (const r of profile.reviews) {
    if (await canViewReview(viewer ? { id: profile.id } : null, r)) {
      // 注意：canViewReview 第二参传的是 review 的 profileId
      // 这里直接判断作者本人，因为只有作者能看 PRIVATE
      visibleReviews.push(r);
    } else if (viewer && (await canViewReview(viewer, r))) {
      visibleReviews.push(r);
    }
  }

  const isOwner = viewer?.profile?.id === profile.id;

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          <p className="text-neutral-600">@{profile.username}</p>
          {profile.bio && <p className="mt-2">{profile.bio}</p>}
          {isOwner && (
            <p className="mt-2 text-sm">
              <a href="/settings" className="underline">Edit</a>
            </p>
          )}
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-2">
            Reviews ({visibleReviews.length})
          </h2>
          {visibleReviews.length === 0 ? (
            <p className="text-neutral-600">No visible reviews.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {visibleReviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{r.restaurant.name}</p>
                      <p className="text-sm text-neutral-600">
                        {r.restaurant.areaCn} · {r.restaurant.cuisine}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">{r.overall.toFixed(1)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
