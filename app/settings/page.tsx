import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/db";

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
          <div className="text-sm space-x-3">
            <a href={`/${user.profile.username}`} className="underline">
              View public profile
            </a>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
              }}
              className="underline text-red-600"
            >
              Log out
            </button>
          </div>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-2">My reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-neutral-600">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {reviews.map((r) => (
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
                      <p className="text-xs text-neutral-500">{r.visibility}</p>
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
