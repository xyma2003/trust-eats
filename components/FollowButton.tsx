"use client";

import { useState, useTransition } from "react";

type Props = {
  targetUsername: string;
  initialFollowing: boolean;
  initialFriends: boolean;
};

export function FollowButton({ targetUsername, initialFollowing, initialFriends }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [friends, setFriends] = useState(initialFriends);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    if (following) {
      await fetch(`/api/follows/${targetUsername}`, { method: "DELETE" });
      setFollowing(false);
      setFriends(false);
    } else {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followeeUsername: targetUsername }),
      });
      const data = await res.json();
      if (data.ok) {
        setFollowing(true);
        setFriends(!!data.nowFriends);
      }
    }
  }

  if (friends) {
    return (
      <button
        onClick={() => startTransition(toggle)}
        disabled={pending}
        className="rounded border border-green-600 text-green-700 px-3 py-1 text-sm"
      >
        ✓ Friends
      </button>
    );
  }
  if (following) {
    return (
      <button
        onClick={() => startTransition(toggle)}
        disabled={pending}
        className="rounded border px-3 py-1 text-sm"
      >
        Following
      </button>
    );
  }
  return (
    <button
      onClick={() => startTransition(toggle)}
      disabled={pending}
      className="rounded bg-black text-white px-3 py-1 text-sm"
    >
      Follow
    </button>
  );
}
