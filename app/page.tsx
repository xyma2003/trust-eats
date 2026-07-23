import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseCuisines } from "@/lib/types";

export default async function Home() {
  const user = await getSessionUser();

  // 取所有 public reviews（不区分作者）——v0.1 简单版
  const publicReviews = await prisma.review.findMany({
    where: {
      visibility: "PUBLIC",
      deletedAt: null,
    },
    include: {
      restaurant: true,
      profile: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold">trust-eats 🍴</h1>
            <p className="text-neutral-600">People-first restaurant reviews</p>
          </div>
          <nav className="space-x-3 text-sm">
            <Link href="/restaurants" className="underline">Browse</Link>
            {user ? (
              <Link href="/settings" className="underline">
                {user.profile?.displayName || "Settings"}
              </Link>
            ) : (
              <>
                <Link href="/login" className="underline">Log in</Link>
                <Link href="/register" className="underline">Register</Link>
              </>
            )}
          </nav>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-3">Recent public reviews</h2>
          {publicReviews.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-300 p-6 text-center text-neutral-500">
              <p>No public reviews yet.</p>
              {user && (
                <Link href="/reviews/new" className="underline mt-2 inline-block">
                  Add the first one
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {publicReviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex justify-between">
                    <div>
                      <Link
                        href={`/restaurants/${r.restaurantId}`}
                        className="font-medium underline"
                      >
                        {r.restaurant.name}
                      </Link>
                      <p className="text-sm text-neutral-600">
                        by{" "}
                        <Link href={`/${r.profile.username}`} className="underline">
                          {r.profile.displayName}
                        </Link>{" "}
                        · {r.restaurant.areaCn} · {parseCuisines(r.restaurant.cuisine).join(" / ")}
                      </p>
                    </div>
                    <div className="font-mono">{r.overall.toFixed(1)}</div>
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
