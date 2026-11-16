import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TeamView } from "@/components/settings/views/TeamView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTeam") };
}
export const instant = false;

export default async function TeamPage() {
  await connection();
  let members: Array<{ id: string; full_name: string; email: string; phone: string | null; role: "admin" | "staff"; is_active: boolean; created_at: string }> | null = null;
  let currentUserId: string | null = null;
  let live = false;

  const supabase = await createClient();
  if (supabase) {
    const [{ data: { user } }, { data: profiles }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("id,full_name,email,phone,role,is_active,created_at").order("created_at", { ascending: true }),
    ]);
    currentUserId = user?.id ?? null;
    members = (profiles ?? []) as NonNullable<typeof members>;
    live = true;
  }

  return <TeamView members={members ?? undefined} currentUserId={currentUserId} live={live} />;
}
