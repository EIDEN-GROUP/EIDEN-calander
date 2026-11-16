"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out everywhere for this browser. Server-side so the session cookie is
 * cleared even when the browser client is stale. Redirect throws
 * NEXT_REDIRECT on success: that is the control flow, not an error.
 */
export async function signOutAction() {
  const supabase = await createClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Cookie store already unavailable: the proxy will bounce us to /login.
    }
  }
  redirect("/login");
}
