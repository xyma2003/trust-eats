"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RestaurantPicker } from "@/components/RestaurantPicker";

type CuisineStr = string;

function parseCuisines(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseList(s: string): string[] {
  if (!s.trim()) return [];
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function NewReviewPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const restaurantId = (form.get("restaurantId") as string) || "";
    const newRestaurantName = form.get("newRestaurant.name") as string | null;

    if (!restaurantId && !newRestaurantName) {
      setError("Pick an existing restaurant or add a new one.");
      setSubmitting(false);
      return;
    }

    const newRestaurant = newRestaurantName
      ? {
          name: newRestaurantName,
          nameEn: (form.get("newRestaurant.nameEn") as string) || undefined,
          area: form.get("newRestaurant.area") as string,
          areaCn: form.get("newRestaurant.areaCn") as string,
          address: (form.get("newRestaurant.address") as string) || undefined,
          phone: (form.get("newRestaurant.phone") as string) || undefined,
          cuisine: parseCuisines(form.get("newRestaurant.cuisine") as string),
          priceTier: (form.get("newRestaurant.priceTier") as string) || undefined,
          url: (form.get("newRestaurant.url") as string) || undefined,
        }
      : undefined;

    const tasteStr = form.get("taste") as string;
    const envStr = form.get("environment") as string;
    const svcStr = form.get("service") as string;
    const valStr = form.get("value") as string;

    const payload = {
      restaurantId,
      newRestaurant,
      taste: parseFloat(tasteStr),
      environment: envStr ? parseFloat(envStr) : undefined,
      service: svcStr ? parseFloat(svcStr) : undefined,
      value: valStr ? parseFloat(valStr) : undefined,
      mustOrder: parseList(form.get("mustOrder") as string),
      avoidItems: parseList(form.get("avoidItems") as string),
      otherTries: parseList(form.get("otherTries") as string),
      wantToTry: parseList(form.get("wantToTry") as string),
      notes: (form.get("notes") as string) || "",
      visibility: form.get("visibility") as "PRIVATE" | "FRIENDS" | "PUBLIC",
      lastVisited: (form.get("lastVisited") as string) || undefined,
    };

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "string") setError(data.error);
        else if (data.error?.formErrors?.length) setError(data.error.formErrors.join(", "));
        else setError("Failed to save review");
        return;
      }
      router.push("/settings");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Add a review</h1>
          <p className="text-sm text-neutral-600">
            Fields marked * are required. Others can be left blank.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Restaurant</h2>
            <RestaurantPicker />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Scores</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ScoreInput label="Taste *" name="taste" required />
              <ScoreInput label="Environment" name="environment" />
              <ScoreInput label="Service" name="service" />
              <ScoreInput label="Value" name="value" />
            </div>
            <p className="text-xs text-neutral-500">
              0–10. Overall = taste×0.5 + env×0.15 + svc×0.15 + value×0.2 (missing dims normalized)
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Dishes</h2>
            <ListInput label="Must-order" name="mustOrder" hint="One per line" />
            <ListInput label="Avoid" name="avoidItems" hint="One per line" />
            <ListInput label="Other tries" name="otherTries" hint="One per line" />
            <ListInput label="Want to try" name="wantToTry" hint="One per line" />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Notes</h2>
            <label className="block">
              <span className="text-sm text-neutral-600">Feelings / context</span>
              <textarea
                name="notes"
                rows={5}
                className="mt-1 block w-full rounded border px-3 py-2"
                placeholder="Why this score? Who's it good for? Compared to similar places?"
              />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600">Last visited</span>
              <input
                name="lastVisited"
                placeholder="2025-06 / 多次 / 2026-07"
                className="mt-1 block w-full rounded border px-3 py-2"
              />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Visibility</h2>
            <label className="block">
              <span className="text-sm text-neutral-600">Who can see this review?</span>
              <select
                name="visibility"
                defaultValue="PRIVATE"
                className="mt-1 block w-full rounded border px-3 py-2"
              >
                <option value="PRIVATE">Private (only me)</option>
                <option value="FRIENDS">Friends (mutual follows)</option>
                <option value="PUBLIC">Public (anyone, used in aggregation)</option>
              </select>
            </label>
          </section>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save review"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded border px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ScoreInput({
  label,
  name,
  required,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-600">{label}</span>
      <input
        type="number"
        min={0}
        max={10}
        step={0.1}
        required={required}
        name={name}
        className="mt-1 block w-full rounded border px-3 py-2"
      />
    </label>
  );
}

function ListInput({
  label,
  name,
  hint,
}: {
  label: string;
  name: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-600">{label}</span>
      <textarea
        name={name}
        rows={2}
        className="mt-1 block w-full rounded border px-3 py-2"
        placeholder={hint}
      />
    </label>
  );
}
