"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types/db";
import { logAudit } from "@/lib/audit";

function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}
function failUnexpected(err: unknown): ActionResult<never> {
  console.error("[export] unexpected error", err);
  return { ok: false, error: { code: "unexpected", message: "Export failed on our side. Please try again." } };
}
const notConfigured = (): ActionResult<never> =>
  fail("not_configured", "Supabase isn't configured: set .env.");

/**
 * Full workspace snapshot as a single JSON document (admin only).
 * Covers: business profile (non-secret), working hours, rooms, categories,
 * clients, bookings, formation participants, plans + plan_tasks,
 * change_requests. Notifications/audit_log excluded (internal plumbing).
 * Note: serverless responses cap at ~4.5MB: fine at our scale; if a dump
 * ever approaches that, switch to per-table CSV downloads.
 */
export async function exportWorkspaceAction(): Promise<
  ActionResult<{ filename: string; byteLength: number; json: string }>
> {
  try {
    const admin = await requireAdmin();
    const supabase = await createClient();
    if (!supabase) return notConfigured();

    const tables = [
      "business_settings",
      "working_hours",
      "rooms",
      "categories",
      "clients",
      "bookings",
      "formation_participants",
      "plans",
      "plan_tasks",
      "change_requests",
    ] as const;

    const results = await Promise.all(
      tables.map(async (table) => {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.error(`[export] ${table} failed`, error.message);
          return [table, []] as const;
        }
        // Scrub updated_by/actor ids: they identify staff internals, not business data.
        const scrubbed = (data ?? []).map((row: Record<string, unknown>) => {
          const rest = { ...row };
          delete rest.updated_by; // staff-internal actor id, not business data
          return rest;
        });
        return [table, scrubbed] as const;
      }),
    );

    const payload = {
      export: "eiden-calendar",
      version: 2,
      exportedAt: new Date().toISOString(),
      generatedBy: admin.email,
      tables: Object.fromEntries(results),
    };
    const json = JSON.stringify(payload, null, 2);

    await logAudit(supabase, {
      action: "workspace.export",
      entityType: "workspace",
      entityId: "snapshot",
      meta: { tables: Object.fromEntries(results.map(([t, rows]) => [t, rows.length])) },
    });

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      ok: true,
      data: {
        filename: `eiden-calendar-export-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`,
        byteLength: Buffer.byteLength(json, "utf8"),
        json,
      },
    };
  } catch (err) {
    return failUnexpected(err);
  }
}
