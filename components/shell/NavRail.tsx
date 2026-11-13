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
  Settings,
} from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/formations", label: "Formations", icon: GraduationCap },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/plans", label: "Plans", icon: KanbanSquare },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/inbox", label: "Inbox", icon: Mail },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-divider bg-canvas/60 py-4 backdrop-blur-sm lg:flex"
    >
      {/* Brand mark */}
      <Link
        href="/dashboard"
        aria-label="CALENDAR. — home"
        className="flex h-14 w-14 items-center justify-center rounded-md transition-transform duration-200 hover:scale-105"
      >
        <NowBarMark size={44} title="CALENDAR." />
      </Link>

      {/* Main nav */}
      <div className="mt-6 flex flex-col gap-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
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
          aria-label="Settings"
          title="Settings"
          data-active={isActive(pathname, "/settings")}
          className="rail-btn"
        >
          <Settings size={20} strokeWidth={1.9} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
