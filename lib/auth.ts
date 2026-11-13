import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types/db";

export class AuthError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "AuthError";
  }
}
export class AdminRequiredError extends Error {
  constructor(message = "Admin access required") {
    super(message);
    this.name = "AdminRequiredError";
  }
}

/** True when Supabase env vars exist (fresh clone without .env → demo/preview mode). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Resolve the current user + profile, or null when unauthenticated/unconfigured. */
export async function getSessionProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,phone,avatar_url,role,is_active,must_change_password,locale")
    .eq("id", user.id)
    .single();
  if (!data || !data.is_active) return null;
  return data as ProfileRow;
}

/** Like getSessionProfile but throws — for server actions that must have a user. */
export async function requireUser(): Promise<ProfileRow> {
  const profile = await getSessionProfile();
  if (!profile) throw new AuthError();
  return profile;
}

/** Admin gate for privileged server actions. */
export async function requireAdmin(): Promise<ProfileRow> {
  const profile = await requireUser();
  if (profile.role !== "admin") throw new AdminRequiredError();
  return profile;
}
