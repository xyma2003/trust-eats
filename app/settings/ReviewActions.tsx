"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  reviewId: string;
  restaurantName: string;
};

export function ReviewActions({ reviewId, restaurantName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"none" | "revoke" | "delete">("none");

  async function revoke() {
    await fetch(`/api/reviews/${reviewId}/revoke`, { method: "POST" });
    setConfirming("none");
    router.refresh();
  }

  async function del() {
    await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
    setConfirming("none");
    router.refresh();
  }

  if (confirming === "revoke") {
    return (
      <div className="flex gap-2 text-xs">
        <span className="text-neutral-700">
          Revoke {restaurantName}? (留痕，聚合分移除)
        </span>
        <button
          onClick={() => startTransition(revoke)}
          disabled={pending}
          className="text-orange-700 underline"
        >
          Confirm
        </button>
        <button onClick={() => setConfirming("none")} className="text-neutral-500 underline">
          Cancel
        </button>
      </div>
    );
  }
  if (confirming === "delete") {
    return (
      <div className="flex gap-2 text-xs">
        <span className="text-red-700 font-semibold">
          PERMANENTLY DELETE {restaurantName}?
        </span>
        <button
          onClick={() => startTransition(del)}
          disabled={pending}
          className="text-red-700 underline font-semibold"
        >
          Delete forever
        </button>
        <button onClick={() => setConfirming("none")} className="text-neutral-500 underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-xs">
      <button
        onClick={() => setConfirming("revoke")}
        className="text-orange-700 underline"
      >
        Revoke
      </button>
      <button
        onClick={() => setConfirming("delete")}
        className="text-red-700 underline"
      >
        Delete
      </button>
    </div>
  );
}
