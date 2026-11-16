"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Persist the viewer's locale choice: the render cookie (source of truth
 * for every request) + the profile row (so the choice survives devices and
 * browser wipes). Cookie first — the profile sync is best-effort.
 */
export async function setLocaleAction(raw: unknown): Promise<{ ok: true; locale: "en" | "fr" }> {
  const locale = raw === "fr" ? "fr" : "en";
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  try {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ locale, updated_at: new Date().toISOString() }).eq("id", user.id);
      }
    }
  } catch (err) {
    console.error("[locale] profile sync failed (cookie already set)", err);
  }
  return { ok: true, locale };
}
