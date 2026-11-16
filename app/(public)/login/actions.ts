"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  ok: boolean;
  configured: boolean;
  errorKey?: "notConfigured" | "missing" | "invalid";
};

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      ok: false,
      configured: false,
      errorKey: "notConfigured",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { ok: false, configured: true, errorKey: "missing" };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message on purpose — never reveal which part failed.
    return { ok: false, configured: true, errorKey: "invalid" };
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}
