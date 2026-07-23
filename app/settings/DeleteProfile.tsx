"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteProfile() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"idle" | "confirm">("idle");

  async function del() {
    await fetch("/api/profiles/me", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  if (step === "confirm") {
    return (
      <div className="border border-red-300 rounded p-4 bg-red-50 space-y-2">
        <p className="text-sm font-semibold text-red-800">
          This will permanently revoke all your reviews and soft-delete your profile.
        </p>
        <p className="text-xs text-red-700">
          - All your reviews will be revoked (no longer in aggregate scores)
          <br />
          - Your profile becomes inaccessible
          <br />- Your account can no longer log in
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => startTransition(del)}
            disabled={pending}
            className="rounded bg-red-700 text-white px-3 py-1 text-sm"
          >
            Yes, delete my account
          </button>
          <button
            onClick={() => setStep("idle")}
            className="rounded border px-3 py-1 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setStep("confirm")}
      className="text-xs text-red-700 underline"
    >
      Delete my account
    </button>
  );
}
