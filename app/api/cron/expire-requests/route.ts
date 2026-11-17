/**
 * GET /api/cron/expire-requests: closes pending change requests past their
 * 72h deadline. Protected by CRON_SECRET bearer token. Idempotent.
 *
 * Scheduling: hourly via Supabase pg_cron → pg_net (see docs/RUNBOOK.md);
 * daily 05:00 UTC fallback via vercel.json (Hobby accounts cannot run hourly
 * crons). Exactly-once email is guaranteed by the expired_notified_at stamp:
 * schedulers may overlap or repeat freely.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyChangeRequestEvent } from "@/lib/email/notify";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: { code: "unconfigured", message: "CRON_SECRET is not set." } },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Invalid bearer token." } },
      { status: 401 },
    );
  }

  try {
    const supabase = createServiceClient();

    // Rows needing the "expired" email: not mailed yet, and either still
    // pending past their deadline (the rpc below flips them this run) or
    // already flipped by the SQL sweeper. One stamp per row, forever.
    const nowIso = new Date().toISOString();
    const { data: pending, error: listErr } = await supabase
      .from("change_requests")
      .select("id,requested_by")
      .is("expired_notified_at", null)
      .or(`and(status.eq.pending,expires_at.lt.${nowIso}),status.eq.expired`)
      .limit(50);
    if (listErr) throw listErr;

    const { data, error } = await supabase.rpc("expire_change_requests");
    if (error) throw error;

    // Notify requesters whose requests were just expired.
    const ids = (pending ?? []).map((row) => row.id as string);
    for (const row of pending ?? []) {
      try {
        await notifyChangeRequestEvent(supabase, row.id as string, "expired");
      } catch (e) {
        console.error("[cron] expiry mail failed for request", row.id, e);
      }
    }
    if (ids.length > 0) {
      const { error: stampErr } = await supabase
        .from("change_requests")
        .update({ expired_notified_at: new Date().toISOString() })
        .in("id", ids);
      if (stampErr) console.error("[cron] could not stamp expired_notified_at:", stampErr.message);
    }

    return NextResponse.json({ ok: true, expired: data ?? 0, notified: ids.length });
  } catch (err) {
    console.error("[cron] expire-requests failed", err);
    return NextResponse.json(
      { ok: false, error: { code: "unexpected", message: "Expire job failed." } },
      { status: 500 },
    );
  }
}
