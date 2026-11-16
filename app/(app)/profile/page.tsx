import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/components/settings/views/ProfileView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("pageTitle") };
}
export const instant = false;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ "first-login"?: string }>;
}) {
  const params = await searchParams;
  const firstLogin = params["first-login"] === "1";

  let profile: { fullName: string; email: string; phone: string | null; locale: "en" | "fr"; role: "admin" | "staff"; memberSince: string | null } | null = null;
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,email,phone,locale,role,created_at")
        .eq("id", user.id)
        .single();
      if (data) {
        profile = {
          fullName: data.full_name as string,
          email: data.email as string,
          phone: (data.phone as string | null) ?? null,
          locale: ((data.locale as string) === "fr" ? "fr" : "en") as "en" | "fr",
          role: (data.role as "admin" | "staff") ?? "staff",
          memberSince: (data.created_at as string) ?? null,
        };
      }
    }
  }

  return <ProfileView firstLogin={firstLogin} profile={profile} />;
}
