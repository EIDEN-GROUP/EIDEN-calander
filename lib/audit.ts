import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * logAudit — the single write path for the audit trail from server code.
 *
 * `audit_log` has no INSERT policy for `authenticated`; writes go through the
 * `log_audit_event()` security-definer RPC, which stamps actor_id from
 * auth.uid() (see supabase/migrations/0007_log_audit_event.sql). Inserts made
 * directly through the authenticated client were silently rejected before
 * this helper existed.
 *
 * Never throws: a failed audit write is logged loudly but does not mask the
 * business operation that already committed.
 */
export async function logAudit(
  supabase: Pick<SupabaseClient, "rpc"> | null,
  entry: {
    action: string;
    entityType?: string | null;
    entityId?: string | number | null;
    meta?: Record<string, unknown> | null;
  },
): Promise<void> {
  if (!supabase) {
    console.warn(`[audit] skipped "${entry.action}" — Supabase not configured`);
    return;
  }
  try {
    const { error } = await supabase.rpc("log_audit_event", {
      p_action: entry.action,
      p_entity_type: entry.entityType ?? null,
      p_entity_id: entry.entityId != null ? String(entry.entityId) : null,
      p_meta: entry.meta ?? {},
    });
    if (error) {
      console.error(`[audit] log_audit_event failed for action "${entry.action}":`, error.message);
    }
  } catch (err) {
    console.error(`[audit] unexpected failure writing action "${entry.action}":`, err);
  }
}
