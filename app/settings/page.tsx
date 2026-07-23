import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseCuisines } from "@/lib/types";
import { SettingsActions } from "./SettingsActions";
import { ReviewActions } from "./ReviewActions";
import { DeleteProfile } from "./DeleteProfile";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");
  if (!user.profile) redirect("/register");

  const reviews = await prisma.review.findMany({
    where: { profileId: user.profile.id, deletedAt: null },
    include: { restaurant: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold">{user.profile.displayName}</h1>
            <p className="text-neutral-600">@{user.profile.username}</p>
          </div>
          <SettingsActions username={user.profile.username} />
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-2">My reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-neutral-600">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {reviews.map((r) => {
                const cuisines = parseCuisines(r.restaurant.cuisine);
                return (
                  <li key={r.id} className="py-3">
                    <div className="flex justify-between">
                      <div>
                        <a
                          href={`/restaurants/${r.restaurantId}`}
                          className="font-medium underline"
                        >
                          {r.restaurant.name}
                        </a>
                        <p className="text-sm text-neutral-600">
                          {r.restaurant.areaCn} · {cuisines.join(" / ")}
                        </p>
                        <div className="mt-2">
                          <ReviewActions
                            reviewId={r.id}
                            restaurantName={r.restaurant.name}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{r.overall.toFixed(1)}</p>
                        <p className="text-xs text-neutral-500">{r.visibility}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="border-t pt-4">
          <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Deleting your account revokes all your reviews (no longer in aggregate scores)
            and makes your profile inaccessible.
          </p>
          <div className="mt-3">
            <DeleteProfile />
          </div>
        </section>
      </div>
    </main>
  );
}
