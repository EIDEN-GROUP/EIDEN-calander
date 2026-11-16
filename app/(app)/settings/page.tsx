import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Building2,
  SwatchBook,
  DoorOpen,
  UsersRound,
  Clock3,
  BellRing,
  Languages,
  ScrollText,
  ShieldCheck,
  Database,
  Inbox,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("hubTitle") };
}
export const instant = false;

type Tab = { slug: string; nameKey: string; descKey: string; icon: LucideIcon; admin?: boolean };

const TABS: Tab[] = [
  { slug: "general", nameKey: "tabGeneral", descKey: "tabGeneralDesc", icon: Building2, admin: true },
  { slug: "categories", nameKey: "tabCategories", descKey: "tabCategoriesDesc", icon: SwatchBook, admin: true },
  { slug: "rooms", nameKey: "tabRooms", descKey: "tabRoomsDesc", icon: DoorOpen, admin: true },
  { slug: "team", nameKey: "tabTeam", descKey: "tabTeamDesc", icon: UsersRound, admin: true },
  { slug: "working-hours", nameKey: "tabWorkingHours", descKey: "tabWorkingHoursDesc", icon: Clock3, admin: true },
  { slug: "notifications", nameKey: "tabNotifications", descKey: "tabNotificationsDesc", icon: BellRing, admin: true },
  { slug: "localization", nameKey: "tabLocalization", descKey: "tabLocalizationDesc", icon: Languages, admin: true },
  { slug: "audit", nameKey: "tabAudit", descKey: "tabAuditDesc", icon: ScrollText, admin: true },
  { slug: "security", nameKey: "tabSecurity", descKey: "tabSecurityDesc", icon: ShieldCheck },
  { slug: "data", nameKey: "tabData", descKey: "tabDataDesc", icon: Database, admin: true },
  { slug: "mail", nameKey: "tabMail", descKey: "tabMailDesc", icon: Inbox, admin: true },
];

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em] text-obsidian">{t("hubTitle")}</h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">
            {t("hubSub")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {TABS.map(({ slug, nameKey, descKey, icon: Icon, admin }) => (
          <Link
            key={slug}
            href={`/settings/${slug}`}
            className="card card-hover group flex items-start gap-4 p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-tint-blue text-electric">
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-obsidian">{t(nameKey)}</span>
                {admin && (
                  <span className="rounded-pill bg-canvas px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
                    {t("adminBadge")}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[12px] font-medium leading-snug text-obsidian-light">{t(descKey)}</span>
            </span>
            <ChevronRight
              size={17}
              strokeWidth={2.2}
              className="ml-auto mt-1 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
