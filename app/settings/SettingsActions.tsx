"use client";

export function SettingsActions({ username }: { username: string }) {
  return (
    <div className="text-sm space-x-3">
      <a href={`/${username}`} className="underline">
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
  );
}
