import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CreditCard,
  GraduationCap,
  Mail,
  UserPlus,
  Wrench,
} from "lucide-react";
import { listNotificationsAction } from "@/app/actions/notifications";
import { NowBarMark } from "@/components/brand/NowBar";
import { MarkReadIsland } from "@/components/notifications/MarkReadIsland";

export const metadata: Metadata = { title: "Notifications" };
// Reads live data at request time — block prerender.
export const instant = false;

const ICONS: Record<string, typeof Bell> = {
  booking_created: CalendarClock,
  booking_updated: CalendarClock,
  booking_cancelled: CalendarClock,
  formation_reminder: GraduationCap,
  change_request_received: Wrench,
  change_request_approved: Wrench,
  change_request_declined: Wrench,
  change_request_expired: Wrench,
  welcome: UserPlus,
  weekly_digest: Mail,
};

function iconFor(type: string) {
  return ICONS[type] ?? ((type.startsWith("mail") ? Mail : Bell) as typeof Bell);
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default async function NotificationsPage() {
  await connection();
  const result = await listNotificationsAction(50);
  const notifications = result.ok ? result.data.notifications : [];
  const unread = result.ok ? result.data.unread : 0;

  const groups: Array<{ label: string; items: typeof notifications }> = [];
  for (const n of notifications) {
    const label = dayLabel(n.created_at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em] text-obsidian">
            Notifications
          </h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">
            {unread > 0 ? `${unread} unread — mentions, confirmations and change requests` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && <MarkReadIsland />}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-20 text-center">
          <NowBarMark size={56} className="opacity-90" />
          <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.03em] text-obsidian">
            No notifications yet
          </h2>
          <p className="mt-1.5 max-w-sm text-[14px] leading-snug text-obsidian-light">
            Booking updates, change requests and formation reminders will show up here in real time.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                {group.label}
              </h2>
              <ul className="mt-2 divide-y divide-divider overflow-hidden rounded-md border border-border bg-white shadow-sm">
                {group.items.map((n) => {
                  const Icon = iconFor(n.type);
                  const body = (
                    <div className="flex items-start gap-3.5 p-4 transition-colors hover:bg-canvas/60">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-tint-blue text-electric">
                        <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[14px] font-bold leading-snug text-obsidian">{n.title}</span>
                          {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-pill bg-electric" aria-label="Unread" />}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block text-[13px] font-medium leading-snug text-obsidian-light">
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block font-mono text-[11px] tabular-nums text-muted">
                          {new Date(n.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </div>
                  );
                  return (
                    <li key={n.id} className="relative">
                      {n.link ? (
                        <Link href={n.link} className="block outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-electric-tint)]">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                      {!n.read_at && (
                        <span className="absolute right-3 top-3">
                          <MarkReadIsland id={n.id} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Footer note for the empty-data case */}
      {result.ok && notifications.length > 0 && (
        <p className="mt-6 flex items-center gap-2 text-[11px] font-medium text-muted">
          <CheckCheck size={13} aria-hidden="true" /> Showing the latest 50 — retention is 90 days.
        </p>
      )}
    </div>
  );
}
