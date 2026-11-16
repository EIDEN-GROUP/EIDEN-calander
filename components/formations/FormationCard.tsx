import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { appLocaleTag } from "@/lib/intl-locale";
import { ArrowRight, CalendarDays, Copy, DoorOpen } from "lucide-react";
import {
  effectiveStatus,
  fillPercent,
  formatDay,
  formatMad,
  formatTimeRange,
  locationBadge,
  roomById,
  seatsLeft,
  stripDemoSuffix,
  type FormationVM,
} from "./model";
import type { RoomRow } from "@/lib/types/db";
import { FillRing } from "./FillRing";
import { FormationStatusChip, StatusChip } from "./StatusChip";

export function FormationCard({
  vm,
  onDuplicate,
  rooms,
}: {
  vm: FormationVM;
  onDuplicate: (vm: FormationVM) => void;
  rooms?: RoomRow[];
}) {
  const t = useTranslations("formations");
  const intlLocale = appLocaleTag(useLocale());
  const { booking, formation, participants } = vm;
  const status = effectiveStatus(vm);
  const left = seatsLeft(formation, participants);
  const pct = fillPercent(formation, participants);
  const room = roomById(booking.room_id, rooms);

  return (
    <article className="card card-hover flex flex-col p-5" aria-label={booking.title}>
      {/* Top row: chips + fill ring */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="green" className="tracking-[0.06em]">
            {t("chipFormation")}
          </StatusChip>
          <FormationStatusChip status={status} seatsLeft={left} />
        </div>
        <FillRing percent={pct} size={52} />
      </div>

      {/* Title */}
      <h2 className="mt-3 min-h-[2.9rem] line-clamp-2 text-[17px] font-bold leading-snug tracking-[-0.01em] text-obsidian">
        {booking.title}
      </h2>

      {/* Meta */}
      <div className="mt-2 space-y-1.5 text-[13px] font-medium text-obsidian-light">
        <p className="flex items-center gap-2">
          <CalendarDays size={15} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="tabular-nums">
            {formatDay(booking.starts_at, intlLocale)} · {formatTimeRange(booking.starts_at, booking.ends_at, intlLocale)}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <DoorOpen size={15} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="truncate">{room ? stripDemoSuffix(room.name) : t("roomToBeAssigned")}</span>
          <span className="chip bg-track px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            {locationBadge(room?.location)}
          </span>
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-divider pt-4">
        <span className="chip bg-track font-mono text-[11px] font-semibold tracking-tight text-obsidian">
          {formation.price_label != null ? `${formatMad(formation.price_label)} ${t("perSeat")}` : t("priceOnRequest")}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={`/formations/${booking.id}`}
          className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-bold text-electric transition-colors hover:text-electric-hover"
        >
          {t("viewRoster")}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => onDuplicate(vm)}
          aria-label={t("duplicateAria", { title: booking.title })}
          title={t("duplicateWeek")}
          className="flex h-9 w-9 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian"
        >
          <Copy size={17} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
