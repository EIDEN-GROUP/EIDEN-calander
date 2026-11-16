import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";

const NAMES: Record<string, { title: string; desc: string; phase: string }> = {
  general: { title: "General", desc: "Business name, legal name, logo, contact, timezone and currency.", phase: "3" },
  categories: { title: "Categories", desc: "Create booking categories — EN/FR names, tint colors, icons, types.", phase: "3" },
  rooms: { title: "Rooms & Resources", desc: "Rooms with location (Casablanca / Agadir), capacity, rates and amenities.", phase: "3" },
  team: { title: "Team & Users", desc: "Create accounts with one-time passwords, roles, deactivate staff.", phase: "3" },
  "working-hours": { title: "Working Hours", desc: "Per-weekday open/close, closed days, slot increment and buffers.", phase: "3" },
  notifications: { title: "Notifications", desc: "Per-event email toggles and the Monday digest.", phase: "3" },
  localization: { title: "Localization", desc: "Default locale EN/FR, hour and date formats.", phase: "3" },
  audit: { title: "Audit Log", desc: "Searchable, filterable log of every change — export to CSV.", phase: "4" },
  security: { title: "Security", desc: "Change password, sign out all sessions, MFA enrollment.", phase: "4" },
  data: { title: "Data & Privacy", desc: "Export the workspace, anonymize clients — with confirmation.", phase: "4" },
  mail: { title: "Mail", desc: "SMTP/IMAP connection tests for the connected mailbox.", phase: "3" },
};

export function generateStaticParams() {
  return Object.keys(NAMES).map((tab) => ({ tab }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tab: string }>;
}): Promise<Metadata> {
  const { tab } = await params;
  return { title: NAMES[tab]?.title ?? "Settings" };
}

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  const entry = NAMES[tab];

  if (!entry) {
    return <EmptyState title="Unknown setting" description="This settings section doesn't exist." />;
  }
  return <EmptyState title={entry.title} description={entry.desc} phase={entry.phase} />;
}
