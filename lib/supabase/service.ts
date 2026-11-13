import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE Supabase client — SERVER ONLY.
 * Bypasses RLS. Use exclusively in server actions / scripts for
 * administrative operations (user provisioning, webhooks, cron).
 * Never import from client components. Never expose to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only).",
    );
  }
  return createSbClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
