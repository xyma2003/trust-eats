import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { computeAggregateScore } from "@/lib/scoring";
import { parseCuisines } from "@/lib/types";

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const area = params.area?.trim() ?? "";

  const user = await getSessionUser();

  let restaurants: Awaited<ReturnType<typeof prisma.restaurant.findMany>> = [];
  if (q || area) {
    const where: Record<string, unknown> = {};
    if (q) where.OR = [{ name: { contains: q } }, { nameEn: { contains: q } }];
    if (area) where.area = area;
    restaurants = await prisma.restaurant.findMany({
      where,
      take: 50,
      orderBy: { name: "asc" },
    });
  }

  // 算聚合分
  const viewer = user?.profile ? { profileId: user.profile.id } : null;
  const withScores = await Promise.all(
    restaurants.map(async (r) => {
      const aggregate = await computeAggregateScore(viewer, r.id);
      return { ...r, aggregate };
    })
  );

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Restaurants</h1>
          <p className="text-sm text-neutral-600">
            Scores shown are personalized based on who you follow.
            {!user && " Log in to see personalized scores."}
          </p>
        </header>

        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name..."
            className="flex-1 rounded border px-3 py-2"
          />
          <input
            type="text"
            name="area"
            defaultValue={area}
            placeholder="area slug"
            className="w-40 rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-black text-white px-4 py-2">
            Search
          </button>
        </form>

        {withScores.length === 0 ? (
          <p className="text-neutral-600">
            {q || area ? "No results." : "Type a search query to start."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {withScores.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Link
                      href={`/restaurants/${r.id}`}
                      className="font-medium underline"
                    >
                      {r.name}
                    </Link>
                    <p className="text-sm text-neutral-600">
                      {r.areaCn} · {parseCuisines(r.cuisine).join(" / ")}
                      {r.priceTier ? ` · ${r.priceTier}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.aggregate.score !== null ? (
                      <>
                        <p className="text-xl font-mono font-semibold">
                          {r.aggregate.score.toFixed(1)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          from {r.aggregate.reviewerCount}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-neutral-400">—</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
