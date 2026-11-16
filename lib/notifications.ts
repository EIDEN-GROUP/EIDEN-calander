import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * notifyUser: the single write path for in-app notifications.
 *
 * `notifications` has no INSERT policy for `authenticated`; every write goes
 * through the `notify_user()` security-definer RPC (see
 * supabase/migrations/0004_functions.sql). Direct inserts through the
 * authenticated client were silently rejected before this helper existed:
 * the bell counter showed 0 while change requests fired.
 *
 * Never throws: a failed notification is logged loudly but does not mask the
 * business operation that already committed.
 */
export async function notifyUser(
  supabase: Pick<SupabaseClient, "rpc"> | null,
  entry: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string | null;
    entityId?: string | null;
  },
): Promise<void> {
  if (!supabase) {
    console.warn(`[notify] skipped type "${entry.type}": Supabase not configured`);
    return;
  }
  try {
    const { error } = await supabase.rpc("notify_user", {
      p_user_id: entry.userId,
      p_type: entry.type,
      p_title: entry.title,
      p_body: entry.body ?? "",
      p_link: entry.link ?? null,
      p_entity_id: entry.entityId ?? null,
    });
    if (error) {
      console.error(`[notify] notify_user failed for type "${entry.type}":`, error.message);
    }
  } catch (err) {
    console.error(`[notify] unexpected failure writing type "${entry.type}":`, err);
  }
}
