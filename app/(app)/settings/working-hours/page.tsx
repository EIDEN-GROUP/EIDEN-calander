import type { Metadata } from "next";
import { connection } from "next/server";
import { WorkingHoursView, type WorkingHoursInitial } from "@/components/settings/views/WorkingHoursView";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Working Hours · Settings" };
export const instant = false;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default async function WorkingHoursPage() {
  await connection();

  let initial: WorkingHoursInitial | null = null;
  const supabase = await createClient();
  if (supabase) {
    const [{ data: wh }, { data: settings }] = await Promise.all([
      supabase.from("working_hours").select("weekday,is_open,open_time,close_time"),
      supabase.from("business_settings").select("slot_increment_min,buffer_min,min_notice_hours").maybeSingle(),
    ]);
    const order = new Map(DAY_KEYS.map((d, i) => [d, i]));
    const week = (wh ?? [])
      .map((r) => ({
        key: r.weekday as (typeof DAY_KEYS)[number],
        isOpen: Boolean(r.is_open),
        open: String(r.open_time),
        close: String(r.close_time),
      }))
      .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
    if (week.length === 7) {
      initial = {
        week,
        slot: (settings?.slot_increment_min ?? 30) as 15 | 30 | 60,
        buffer: Number(settings?.buffer_min ?? 0),
        minNotice: Number(settings?.min_notice_hours ?? 2),
      };
    }
  }

  return <WorkingHoursView initial={initial} />;
}
