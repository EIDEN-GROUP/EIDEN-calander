/**
 * GET /api/cron/expire-requests — closes pending change requests past their
 * 72h deadline. Protected by CRON_SECRET bearer token. Idempotent.
 *
 * Schedule: hourly, via vercel.json.
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

    // Find the pending requests that are about to expire so we can email them.
    const { data: pending, error: listErr } = await supabase
      .from("change_requests")
      .select("id,requested_by")
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .limit(50);
    if (listErr) throw listErr;

    const { data, error } = await supabase.rpc("expire_change_requests");
    if (error) throw error;

    // Notify requesters whose requests were just expired.
    for (const row of pending ?? []) {
      try {
        await notifyChangeRequestEvent(supabase, row.id as string, "expired");
      } catch (e) {
        console.error("[cron] expiry mail failed for request", row.id, e);
      }
    }

    return NextResponse.json({ ok: true, expired: data ?? 0, notified: pending?.length ?? 0 });
  } catch (err) {
    console.error("[cron] expire-requests failed", err);
    return NextResponse.json(
      { ok: false, error: { code: "unexpected", message: "Expire job failed." } },
      { status: 500 },
    );
  }
}
