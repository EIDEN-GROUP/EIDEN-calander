"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Users,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const ITEMS: Array<{ href: string; labelKey: string; icon: LucideIcon }> = [
  { href: "/dashboard", labelKey: "navHome", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "navCalendar", icon: CalendarDays },
  { href: "/formations", labelKey: "navFormations", icon: GraduationCap },
  { href: "/clients", labelKey: "navClients", icon: Users },
  { href: "/settings", labelKey: "navMore", icon: MoreHorizontal },
];

export function BottomNav() {
  const t = useTranslations("shell");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("navPrimaryMobile")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-elevated backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const label = t(labelKey as "navHome");
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5"
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? "text-electric" : "text-obsidian-light"}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
                  active ? "text-electric" : "text-obsidian-light"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
