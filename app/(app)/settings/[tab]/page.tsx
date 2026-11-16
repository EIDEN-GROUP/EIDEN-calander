import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/EmptyState";

const NAMES: Record<string, { nameKey: string; descKey: string; phase: string }> = {
  general: { nameKey: "tabGeneral", descKey: "tabDescGeneral", phase: "3" },
  categories: { nameKey: "tabCategories", descKey: "tabDescCategories", phase: "3" },
  rooms: { nameKey: "tabRooms", descKey: "tabDescRooms", phase: "3" },
  team: { nameKey: "tabTeam", descKey: "tabDescTeam", phase: "3" },
  "working-hours": { nameKey: "tabWorkingHours", descKey: "tabDescWorkingHours", phase: "3" },
  notifications: { nameKey: "tabNotifications", descKey: "tabDescNotifications", phase: "3" },
  localization: { nameKey: "tabLocalization", descKey: "tabDescLocalization", phase: "3" },
  audit: { nameKey: "tabAudit", descKey: "tabDescAudit", phase: "4" },
  security: { nameKey: "tabSecurity", descKey: "tabDescSecurity", phase: "4" },
  data: { nameKey: "tabData", descKey: "tabDescData", phase: "4" },
  mail: { nameKey: "tabMail", descKey: "tabDescMail", phase: "3" },
};

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tab: string }>;
}): Promise<Metadata> {
  const { tab } = await params;
  const t = await getTranslations("settings");
  const entry = NAMES[tab];
  return { title: entry ? t(entry.nameKey) : t("hubTitle") };
}

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  const entry = NAMES[tab];
  const t = await getTranslations("settings");

  if (!entry) {
    return <EmptyState title={t("unknownSettingTitle")} description={t("unknownSettingDesc")} />;
  }
  return <EmptyState title={t(entry.nameKey)} description={t(entry.descKey)} phase={entry.phase} />;
}
