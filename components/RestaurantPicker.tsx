"use client";

import { useState, useEffect } from "react";

type Restaurant = {
  id: string;
  name: string;
  nameEn?: string | null;
  area: string;
  areaCn: string;
};

type Mode = "existing" | "new";

export function RestaurantPicker() {
  const [mode, setMode] = useState<Mode>("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [debounceT, setDebounceT] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceT) clearTimeout(debounceT);
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/restaurants/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
    }, 250);
    setDebounceT(t);
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm">
        <label>
          <input
            type="radio"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
          />{" "}
          Pick existing restaurant
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "new"}
            onChange={() => setMode("new")}
          />{" "}
          Add new restaurant
        </label>
      </div>

      {mode === "existing" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search by restaurant name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full rounded border px-3 py-2"
          />
          {results.length > 0 && (
            <ul className="border rounded divide-y divide-neutral-200">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(r.id);
                      setQuery(`${r.name} (${r.areaCn})`);
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="text-sm text-neutral-500 ml-2">
                      {r.areaCn}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedId && (
            <p className="text-sm text-green-700">Selected.</p>
          )}
          <input type="hidden" name="restaurantId" value={selectedId} />
        </div>
      )}

      {mode === "new" && <NewRestaurantForm />}
    </div>
  );
}

function NewRestaurantForm() {
  return (
    <div className="space-y-3 border rounded p-3 bg-neutral-50">
      <label className="block">
        <span className="text-sm text-neutral-600">Name (中文) *</span>
        <input
          required
          name="newRestaurant.name"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-600">Name (EN)</span>
        <input
          name="newRestaurant.nameEn"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-neutral-600">Area slug *</span>
          <input
            required
            name="newRestaurant.area"
            placeholder="causeway-bay"
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-600">Area 中文 *</span>
          <input
            required
            name="newRestaurant.areaCn"
            placeholder="铜锣湾"
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-neutral-600">Cuisines (comma-separated) *</span>
        <input
          required
          name="newRestaurant.cuisine"
          placeholder="粤菜,烧味"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-neutral-600">Address</span>
          <input
            name="newRestaurant.address"
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-600">Phone</span>
          <input
            name="newRestaurant.phone"
            className="mt-1 block w-full rounded border px-3 py-2"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-neutral-600">Price tier</span>
        <select
          name="newRestaurant.priceTier"
          className="mt-1 block w-full rounded border px-3 py-2"
        >
          <option value="">—</option>
          <option value="$">$ (&lt;100)</option>
          <option value="$$">$$ (100-200)</option>
          <option value="$$$">$$$ (200-400)</option>
          <option value="$$$$">$$$$ (400+)</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-neutral-600">URL (OpenRice / 官网)</span>
        <input
          type="url"
          name="newRestaurant.url"
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </label>
    </div>
  );
}
