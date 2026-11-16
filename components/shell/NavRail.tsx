"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Users,
  KanbanSquare,
  BarChart3,
  Mail,
  ArrowLeftRight,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { NowBarMark } from "@/components/brand/NowBar";

const ITEMS = [
  { href: "/dashboard", labelKey: "navDashboard", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "navCalendar", icon: CalendarDays },
  { href: "/formations", labelKey: "navFormations", icon: GraduationCap },
  { href: "/clients", labelKey: "navClients", icon: Users },
  { href: "/plans", labelKey: "navPlans", icon: KanbanSquare },
  { href: "/reports", labelKey: "navReports", icon: BarChart3 },
  { href: "/inbox", labelKey: "navInbox", icon: Mail },
  { href: "/requests", labelKey: "navRequests", icon: ArrowLeftRight },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavRail() {
  const t = useTranslations("shell");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("navPrimary")}
      className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-divider bg-canvas/60 py-4 backdrop-blur-sm lg:flex"
    >
      {/* Brand mark */}
      <Link
        href="/dashboard"
        aria-label={t("brandHome")}
        className="flex h-14 w-14 items-center justify-center rounded-md transition-transform duration-200 hover:scale-105"
      >
        <NowBarMark size={44} title="CALENDAR." />
      </Link>

      {/* Main nav */}
      <div className="mt-6 flex flex-col gap-2">
        {ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const active = isActive(pathname, href);
          const label = t(labelKey);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
              data-active={active}
              className="rail-btn group"
            >
              {active && <span className="now-bar -left-[14px] h-6 top-1/2 -translate-y-1/2 bottom-auto" aria-hidden="true" />}
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            </Link>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="mt-auto flex flex-col gap-2">
        <Link
          href="/settings"
          aria-label={t("navSettings")}
          title={t("navSettings")}
          data-active={isActive(pathname, "/settings")}
          className="rail-btn"
        >
          <Settings size={20} strokeWidth={1.9} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
