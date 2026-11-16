import { connection } from "next/server";
import { appLocaleTag } from "@/lib/intl-locale";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { NowBarMark } from "@/components/brand/NowBar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("requests");
  return { title: t("title") };
}
// Reads live data at request time — block prerender.
export const instant = false;

type Status = "pending" | "approved" | "declined" | "expired" | "cancelled";

interface RequestListItem {
  id: string;
  status: Status;
  message: string | null;
  created_at: string;
  expires_at: string;
  newTitle: string;
  conflictingTitle: string;
  room: string | null;
  requesterName: string;
}

const STATUS_STYLE: Record<Status, { labelKey: string; classes: string }> = {
  pending: { labelKey: "statusPending", classes: "bg-warning-tint text-tint-fg-amber" },
  approved: { labelKey: "statusApproved", classes: "bg-success-tint text-tint-fg-green" },
  declined: { labelKey: "statusDeclined", classes: "bg-danger-tint text-tint-fg-red" },
  expired: { labelKey: "statusExpired", classes: "bg-hover-fill text-muted" },
  cancelled: { labelKey: "statusCancelled", classes: "bg-hover-fill text-muted" },
};

export default async function RequestsIndexPage() {
  await connection();
  const t = await getTranslations("requests");
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: rows, error } = await supabase
    .from("change_requests")
    .select("id,status,message,created_at,expires_at,new_booking_id,conflicting_booking_id,requested_by")
    .order("created_at", { ascending: false })
    .limit(50);

  const changeRequests = (error ? [] : rows ?? []) as Array<{
    id: string;
    status: Status;
    message: string | null;
    created_at: string;
    expires_at: string;
    new_booking_id: string;
    conflicting_booking_id: string;
    requested_by: string;
  }>;

  // Resolve booking titles + room + requester names (small N, three cheap queries).
  const bookingIds = [...new Set(changeRequests.flatMap((r) => [r.new_booking_id, r.conflicting_booking_id]))];
  const profileIds = [...new Set(changeRequests.map((r) => r.requested_by))];
  const [{ data: bookingRows }, { data: profileRows }] = await Promise.all([
    bookingIds.length
      ? supabase.from("bookings").select("id,title,room_id").in("id", bookingIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    profileIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);
  const roomIds = [...new Set((bookingRows ?? []).map((b) => b.room_id as string | null).filter(Boolean))] as string[];
  const { data: roomRows } = roomIds.length
    ? await supabase.from("rooms").select("id,name,location").in("id", roomIds)
    : { data: [] as Array<Record<string, unknown>> };

  const bookingsById = new Map((bookingRows ?? []).map((b) => [b.id as string, b]));
  const roomsById = new Map((roomRows ?? []).map((r) => [r.id as string, r]));
  const profilesById = new Map((profileRows ?? []).map((p) => [p.id as string, p]));

  const items: RequestListItem[] = changeRequests.map((r) => {
    const conflicting = bookingsById.get(r.conflicting_booking_id);
    const roomId = (conflicting?.room_id as string | null) ?? null;
    const room = roomId ? roomsById.get(roomId) : null;
    const requester = profilesById.get(r.requested_by);
    return {
      id: r.id,
      status: r.status,
      message: r.message,
      created_at: r.created_at,
      expires_at: r.expires_at,
      newTitle: (bookingsById.get(r.new_booking_id)?.title as string) ?? t("bookingFallback"),
      conflictingTitle: (conflicting?.title as string) ?? t("bookingFallback"),
      room: room ? `${room.name as string}${room.location ? ` · ${room.location as string}` : ""}` : null,
      requesterName: (requester?.full_name as string) ?? t("someoneFallback"),
    };
  });

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending").slice(0, 30);

  const renderRow = (item: RequestListItem) => {
    const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.cancelled;
    const pendingExpires =
      item.status === "pending"
        ? t("expiresAt", {
            date: new Date(item.expires_at).toLocaleDateString(appLocaleTag(), { day: "numeric", month: "short" }),
            time: new Date(item.expires_at).toLocaleTimeString(appLocaleTag(), { hour: "2-digit", minute: "2-digit" }),
          })
        : null;
    return (
      <li key={item.id}>
        <Link
          href={`/requests/${item.id}`}
          className="flex items-start gap-3.5 p-4 transition-colors hover:bg-canvas/60 outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-electric-tint)]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-tint-blue text-electric">
            <Wrench size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold leading-snug text-obsidian">
                {t("moveTitle", { conflicting: item.conflictingTitle, new: item.newTitle })}
              </span>
              <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] ${style.classes}`}>
                {t(style.labelKey)}
              </span>
            </span>
            <span className="mt-0.5 block text-[12px] font-medium leading-snug text-obsidian-light">
              {t("requestedBy", { name: item.requesterName })}
              {item.room ? ` · ${item.room}` : ""}
              {pendingExpires ? ` · ${pendingExpires}` : ""}
            </span>
            {item.message && (
              <span className="mt-0.5 block truncate text-[12px] leading-snug text-muted">
                {t("messageQuote", { message: item.message })}
              </span>
            )}
            <span className="mt-1 block font-mono text-[11px] tabular-nums text-muted">
              {new Date(item.created_at).toLocaleDateString(appLocaleTag(), { day: "numeric", month: "short" })}{" "}
              {new Date(item.created_at).toLocaleTimeString(appLocaleTag(), { hour: "2-digit", minute: "2-digit" })}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em] text-obsidian">{t("title")}</h1>
          <p className="mt-1 text-[14px] font-medium text-obsidian-light">
            {pending.length > 0 ? t("awaitingCount", { count: pending.length }) : t("noOpenRequests")}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-20 text-center">
          <NowBarMark size={56} className="opacity-90" />
          <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.03em] text-obsidian">
            {t("nothingRequestedYet")}
          </h2>
          <p className="mt-1.5 max-w-sm text-[14px] leading-snug text-obsidian-light">
            {t("emptyBody")}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {pending.length > 0 && (
            <section aria-label={t("awaitingDecision")}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                {t("awaitingDecision")}
              </h2>
              <ul className="mt-2 divide-y divide-divider overflow-hidden rounded-md border border-border bg-white shadow-sm">
                {pending.map(renderRow)}
              </ul>
            </section>
          )}
          {resolved.length > 0 && (
            <section aria-label={t("recentlyResolved")}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
                {t("recentlyResolved")}
              </h2>
              <ul className="mt-2 divide-y divide-divider overflow-hidden rounded-md border border-border bg-white shadow-sm">
                {resolved.map(renderRow)}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-[11px] font-medium text-muted">
        <CalendarClock size={13} aria-hidden="true" /> {t("expiryNote")}
      </p>
    </div>
  );
}
