import Link from "next/link";
import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Settings" };

type Tab = { slug: string; name: string; desc: string; icon: LucideIcon; admin?: boolean };

const TABS: Tab[] = [
  { slug: "general", name: "General", desc: "Business profile, logo, timezone (Casablanca), currency MAD", icon: Building2, admin: true },
  { slug: "categories", name: "Categories", desc: "Booking categories — name EN/FR, color tint, icon", icon: SwatchBook, admin: true },
  { slug: "rooms", name: "Rooms & Resources", desc: "Name, location (Casa / Agadir), capacity, rate, amenities", icon: DoorOpen, admin: true },
  { slug: "team", name: "Team & Users", desc: "Create accounts, roles, deactivate — the only place staff is managed", icon: UsersRound, admin: true },
  { slug: "working-hours", name: "Working Hours", desc: "Per-weekday open/close, closed days, slot increment, buffer", icon: Clock3, admin: true },
  { slug: "notifications", name: "Notifications", desc: "Per-event email toggles, digest, test send", icon: BellRing, admin: true },
  { slug: "localization", name: "Localization", desc: "Default locale (EN/FR), 12/24h, date & currency display", icon: Languages, admin: true },
  { slug: "audit", name: "Audit Log", desc: "Every change, who & when — search, filter, export CSV", icon: ScrollText, admin: true },
  { slug: "security", name: "Security", desc: "Password, sessions, MFA, active device list", icon: ShieldCheck },
  { slug: "data", name: "Data & Privacy", desc: "Export workspace JSON, anonymize a client (GDPR)", icon: Database, admin: true },
  { slug: "mail", name: "Mail", desc: "SMTP/IMAP connection test for the connected mailbox", icon: Inbox, admin: true },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em] text-obsidian">Settings</h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">
            Admin-only areas are marked. Every change is written to the audit log.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {TABS.map(({ slug, name, desc, icon: Icon, admin }) => (
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
                <span className="text-[15px] font-bold text-obsidian">{name}</span>
                {admin && (
                  <span className="rounded-pill bg-canvas px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
                    Admin
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[12px] font-medium leading-snug text-obsidian-light">{desc}</span>
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
