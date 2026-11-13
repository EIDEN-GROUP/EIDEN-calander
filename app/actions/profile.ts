"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types/db";

function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[profile] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Something went wrong. Please try again." } };
}

export async function updateProfileAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().max(40).nullable().optional(),
      locale: z.enum(["en", "fr"]),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Invalid input");
    const supabase = await createClient();
    if (!supabase) return fail("not_configured", "Supabase isn't configured — set .env.");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.fullName, phone: parsed.data.phone ?? null, locale: parsed.data.locale, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) throw error;
    revalidatePath("/profile");
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}

/** Change password — re-verifies the current one first, then signs out OTHER sessions. */
export async function changePasswordAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const profile = await requireUser();
    const parsed = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(10, "At least 10 characters").regex(/[a-zA-Z]/, "Include letters").regex(/\d/, "Include numbers"),
    }).safeParse(raw);
    if (!parsed.success) return fail("validation", parsed.error.issues[0]?.message ?? "Stronger password required");
    const supabase = await createClient();
    if (!supabase) return fail("not_configured", "Supabase isn't configured — set .env.");

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: parsed.data.currentPassword,
    });
    if (verifyError) return fail("current_password", "Your current password is incorrect.");

    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
    if (updateError) throw updateError;

    // Clear the first-login flag so the proxy lets them through next request.
    await supabase
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    await supabase.auth.signOut({ scope: "others" });
    await supabase.from("audit_log").insert({ actor_id: profile.id, action: "auth.password_change", entity_type: "user", entity_id: profile.id });
    return { ok: true, data: { ok: true } };
  } catch (err) {
    return failUnexpected(err);
  }
}
