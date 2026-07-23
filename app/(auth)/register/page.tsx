"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    displayName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error;
        if (typeof msg === "string") setError(msg);
        else if (msg?.formErrors?.length) setError(msg.formErrors.join(", "));
        else setError("Registration failed");
        return;
      }
      router.push("/settings");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-neutral-600">Display name</span>
            <input
              required
              maxLength={64}
              value={form.displayName}
              onChange={(e) => setField("displayName", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-600">Username</span>
            <input
              required
              minLength={2}
              maxLength={32}
              pattern="[a-zA-Z0-9_-]+"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
            <span className="text-xs text-neutral-500">letters, digits, _ or -</span>
          </label>
          <label className="block">
            <span className="text-sm text-neutral-600">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-600">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              className="mt-1 block w-full rounded border px-3 py-2"
            />
            <span className="text-xs text-neutral-500">at least 8 characters</span>
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="text-sm text-neutral-600">
          Already have one? <Link href="/login" className="underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
