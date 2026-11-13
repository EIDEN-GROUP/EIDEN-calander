"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Bell } from "lucide-react";
import { unreadNotificationCountAction } from "@/app/actions/notifications";
import { getProfileSummaryAction, type ProfileSummary } from "@/app/actions/session";

export function TopBar({ notificationCount: initialCount }: { notificationCount?: number }) {
  const [locale, setLocale] = useState<"en" | "fr">("en");
  const [notificationCount, setNotificationCount] = useState(initialCount ?? 0);
  const [me, setMe] = useState<ProfileSummary | null>(null);

  useEffect(() => {
    let active = true;
    unreadNotificationCountAction()
      .then((n) => {
        if (active) setNotificationCount(n);
      })
      .catch(() => {});
    getProfileSummaryAction()
      .then((p) => {
        if (active && p) setMe(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="frosted sticky top-0 z-30 flex h-[68px] items-center gap-3 px-4 sm:px-6">
      {/* Search (⌘K) — visual entry point; wired to command palette later */}
      <label className="relative hidden h-11 w-full max-w-md items-center md:flex">
        <Search
          size={17}
          strokeWidth={2}
          className="pointer-events-none absolute left-4 text-black/35"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search bookings, clients, formations…"
          aria-label="Search"
          className="h-11 w-full rounded-pill border border-border bg-white pl-11 pr-16 text-[14px] text-obsidian outline-none transition-shadow placeholder:text-black/30 focus:border-electric/40 focus:shadow-[0_0_0_4px_var(--color-electric-tint)]"
        />
        <kbd className="pointer-events-none absolute right-4 rounded-md border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-semibold text-obsidian-light">
          ⌘K
        </kbd>
      </label>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        {/* Locale toggle */}
        <div
          role="group"
          aria-label="Interface language"
          className="segmented !rounded-pill border border-border"
        >
          {(["en", "fr"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={`segment uppercase ${locale === l ? "segment-active" : ""}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <Link
          href="/notifications"
          aria-label={`Notifications, ${notificationCount} unread`}
          className="relative flex h-11 w-11 items-center justify-center rounded-pill border border-border bg-white text-obsidian-light transition-all hover:text-obsidian hover:shadow-md"
        >
          <Bell size={19} strokeWidth={1.9} aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-pill bg-electric px-1 text-[9px] font-bold text-white"
            >
              {notificationCount}
            </span>
          )}
        </Link>

        {/* Account */}
        <Link
          href="/profile"
          aria-label="Your profile"
          className="flex items-center gap-2.5 rounded-pill border border-border bg-white p-1 pr-1 transition-shadow hover:shadow-md sm:pr-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-obsidian text-[13px] font-bold text-white">
            {me?.initials ?? "…"}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[13px] font-bold text-obsidian">{me?.fullName ?? "…"}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {me?.role === "admin" ? "Admin" : me?.role === "staff" ? "Staff" : ""}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
