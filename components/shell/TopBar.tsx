"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Search, Bell } from "lucide-react";
import { unreadNotificationCountAction } from "@/app/actions/notifications";
import { getProfileSummaryAction, type ProfileSummary } from "@/app/actions/session";
import { setLocaleAction } from "@/app/actions/locale";
import { requestOpenCommandPalette } from "@/components/keyboard/registry";

export function TopBar({ notificationCount: initialCount }: { notificationCount?: number }) {
  const t = useTranslations("shell");
  const locale = useLocale() as "en" | "fr";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [notificationCount, setNotificationCount] = useState(initialCount ?? 0);
  const [me, setMe] = useState<ProfileSummary | null>(null);
  const [badgePop, setBadgePop] = useState(false);
  const prevCountRef = useRef(initialCount ?? 0);

  // Pop the badge only when the unread count *grows* (a new notification landed).
  useEffect(() => {
    if (notificationCount > prevCountRef.current) setBadgePop(true);
    prevCountRef.current = notificationCount;
  }, [notificationCount]);

  const changeLocale = (next: "en" | "fr") => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  useEffect(() => {
    let active = true;
    const check = () => {
      unreadNotificationCountAction()
        .then((n) => {
          if (active) setNotificationCount(n);
        })
        .catch(() => {});
    };
    check();
    // The bell was mount-only: if a teammate gets a change request while you
    // work, you now see it within a minute without refreshing.
    const timer = window.setInterval(check, 60_000);
    getProfileSummaryAction()
      .then((p) => {
        if (active && p) setMe(p);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="frosted sticky top-0 z-30 flex h-[68px] items-center gap-3 px-4 sm:px-6">
      {/* Search: Spotlight-style button; opens the command palette */}
      <button
        type="button"
        onClick={requestOpenCommandPalette}
        aria-label={t("searchOpenPalette")}
        className="relative hidden h-11 w-full max-w-md items-center rounded-pill border border-border bg-white pl-11 pr-16 text-left text-[14px] text-black/35 transition-shadow hover:shadow-sm focus-visible:shadow-[0_0_0_4px_var(--color-electric-tint)] md:flex"
      >
        <Search
          size={17}
          strokeWidth={2}
          className="pointer-events-none absolute left-4 text-black/35"
          aria-hidden="true"
        />
        <span className="truncate" title={t("searchPlaceholder")}>{t("searchPlaceholder")}</span>
        <kbd className="kbd pointer-events-none absolute right-4">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        {/* Locale toggle */}
        <div
          role="group"
          aria-label={t("languageLabel")}
          className="segmented !rounded-pill border border-border"
        >
          {(["en", "fr"] as const).map((l) => (
            <button
              key={l}
              onClick={() => changeLocale(l)}
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
          aria-label={`${t("notifications")}, ${t("notificationsUnread", { count: notificationCount })}`}
          className="relative flex h-11 w-11 items-center justify-center rounded-pill border border-border bg-white text-obsidian-light transition-all hover:text-obsidian hover:shadow-md"
        >
          <Bell size={19} strokeWidth={1.9} aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              key={notificationCount}
              aria-hidden="true"
              onAnimationEnd={() => setBadgePop(false)}
              className={`absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-pill bg-electric px-1 text-[10px] font-bold text-white ${
                badgePop ? "badge-pop" : ""
              }`}
            >
              {notificationCount}
            </span>
          )}
        </Link>

        {/* Account */}
        <Link
          href="/profile"
          aria-label={t("yourProfile")}
          className="flex items-center gap-2.5 rounded-pill border border-border bg-white p-1 pr-1 transition-shadow hover:shadow-md sm:pr-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-obsidian text-[13px] font-bold text-white">
            {me?.initials ?? "…"}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[13px] font-bold text-obsidian">{me?.fullName ?? "…"}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {me?.role === "admin" ? "Admin" : me?.role === "staff" ? "Staff" : ""}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
