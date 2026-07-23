"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type YearReport = {
  profile: { username: string; displayName: string };
  year: number;
  stats: {
    totalReviews: number;
    activeReviews: number;
    revokedReviews: number;
    avgScore: number;
    distinctAreas: number;
    distinctCuisines: number;
  };
  byArea: [string, number][];
  byCuisine: [string, number][];
  byMonth: number[];
  top: {
    name: string;
    areaCn: string;
    overall: number;
    mustOrder: string[];
  } | null;
  bottom: { name: string; areaCn: string; overall: number } | null;
  places: Array<{
    name: string;
    areaCn: string;
    cuisines: string[];
    overall: number;
    taste: number;
    lastVisited: string | null;
    mustOrder: string[];
    revoked: boolean;
    createdAt: string;
  }>;
};

export default function ExportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<YearReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(y: number) {
    setLoading(true);
    const res = await fetch(`/api/export/year?year=${y}`);
    const data = await res.json();
    setReport(data);
    setLoading(false);
  }

  useEffect(() => {
    load(year);
  }, [year]);

  if (loading || !report) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <Link href="/settings" className="text-sm underline">← Settings</Link>
            <h1 className="text-2xl font-bold mt-2">
              {report.profile.displayName}'s {report.year} Food Year
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setYear(year - 1)}
              className="rounded border px-3 py-1 text-sm"
            >
              ← {year - 1}
            </button>
            <button
              onClick={() => setYear(year + 1)}
              className="rounded border px-3 py-1 text-sm"
              disabled={year >= new Date().getFullYear()}
            >
              {year + 1} →
            </button>
          </div>
        </header>

        <div
          id="year-report"
          className="bg-white border-2 border-neutral-800 rounded-lg p-8 space-y-6"
        >
          <header className="text-center border-b pb-4">
            <h1 className="text-3xl font-bold">
              {report.profile.displayName}
            </h1>
            <p className="text-neutral-600">
              @{report.profile.username} · {report.year} Food Year
            </p>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <Stat label="Restaurants" value={report.stats.totalReviews} />
            <Stat label="Avg score" value={report.stats.avgScore || "—"} />
            <Stat label="Areas" value={report.stats.distinctAreas} />
            <Stat label="Cuisines" value={report.stats.distinctCuisines} />
          </section>

          {report.top && (
            <section className="border rounded p-4 bg-yellow-50">
              <p className="text-xs uppercase text-yellow-700">Top pick</p>
              <p className="text-xl font-semibold">{report.top.name}</p>
              <p className="text-sm text-neutral-600">
                {report.top.areaCn} · score {report.top.overall.toFixed(1)}
              </p>
              {report.top.mustOrder.length > 0 && (
                <p className="text-sm mt-1">
                  Must-order: {report.top.mustOrder.join(", ")}
                </p>
              )}
            </section>
          )}

          {report.byArea.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">By area</h3>
              <div className="space-y-1">
                {report.byArea.map(([area, count]) => (
                  <div key={area} className="flex items-center gap-2 text-sm">
                    <span className="w-24">{area}</span>
                    <div className="flex-1 bg-neutral-100 rounded h-4 overflow-hidden">
                      <div
                        className="bg-neutral-800 h-full"
                        style={{
                          width: `${(count / report.stats.totalReviews) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.byCuisine.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">By cuisine</h3>
              <div className="flex flex-wrap gap-2">
                {report.byCuisine.map(([cuisine, count]) => (
                  <span
                    key={cuisine}
                    className="rounded-full border px-3 py-1 text-sm bg-neutral-50"
                  >
                    {cuisine} · {count}
                  </span>
                ))}
              </div>
            </section>
          )}

          {report.byMonth.some((c) => c > 0) && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Monthly activity</h3>
              <div className="flex items-end gap-1 h-24">
                {report.byMonth.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-neutral-800 rounded-t"
                    style={{
                      height: `${(count / Math.max(...report.byMonth)) * 100}%`,
                    }}
                    title={`${i + 1}月: ${count}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-neutral-500 mt-1">
                <span>Jan</span>
                <span>Dec</span>
              </div>
            </section>
          )}

          {report.places.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">
                All {report.places.length} places
              </h3>
              <ul className="text-sm space-y-1">
                {report.places.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {p.name}{" "}
                      {p.revoked && (
                        <span className="text-xs text-neutral-400">(revoked)</span>
                      )}
                    </span>
                    <span className="font-mono">{p.overall.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="text-center text-xs text-neutral-500 border-t pt-3">
            Generated by trust-eats ·{" "}
            {new Date().toLocaleDateString()}
          </footer>
        </div>

        <p className="text-xs text-neutral-500 text-center">
          截图保存或分享这张年报图。v0.2 会做 PNG 一键导出。
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded p-3">
      <p className="text-2xl font-bold font-mono">{value}</p>
      <p className="text-xs uppercase text-neutral-500">{label}</p>
    </div>
  );
}
