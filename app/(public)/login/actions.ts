"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  ok: boolean;
  configured: boolean;
  error?: string;
};

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      ok: false,
      configured: false,
      error:
        "CALENDAR. isn't connected yet — copy .env.example to .env.local and fill your Supabase keys, then restart the dev server.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { ok: false, configured: true, error: "Enter your email and password." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message on purpose — never reveal which part failed.
    return { ok: false, configured: true, error: "Invalid email or password." };
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}
