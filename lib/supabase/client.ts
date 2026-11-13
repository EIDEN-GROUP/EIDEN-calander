import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Returns null when the project isn't configured
 * (fresh clone before .env is filled) so the UI can degrade gracefully
 * instead of crashing.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createBrowserClient(url, anon);
}
