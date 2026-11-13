"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkingHoursAction } from "@/app/actions/settings";
import {
  ArrowRight,
  CalendarDays,
  CircleExclamationPoint,
  Copy,
  Info,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Switch } from "@/components/settings/Switch";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface DayHours {
  key: DayKey;
  label: string;
  short: string;
  isOpen: boolean;
  open: string;
  close: string;
}

const DEFAULT_WEEK: DayHours[] = [
  { key: "mon", label: "Monday", short: "Mon", isOpen: true, open: "09:00", close: "18:30" },
  { key: "tue", label: "Tuesday", short: "Tue", isOpen: true, open: "09:00", close: "18:30" },
  { key: "wed", label: "Wednesday", short: "Wed", isOpen: true, open: "09:00", close: "18:30" },
  { key: "thu", label: "Thursday", short: "Thu", isOpen: true, open: "09:00", close: "18:30" },
  { key: "fri", label: "Friday", short: "Fri", isOpen: true, open: "09:00", close: "18:30" },
  { key: "sat", label: "Saturday", short: "Sat", isOpen: true, open: "09:30", close: "13:00" },
  { key: "sun", label: "Sunday", short: "Sun", isOpen: false, open: "09:00", close: "18:30" },
];

const SLOT_OPTIONS = [15, 30, 60] as const;
const WINDOW_START = 7 * 60;
const WINDOW_END = 21 * 60;

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function windowPct(mins: number): number {
  const clamped = Math.min(WINDOW_END, Math.max(WINDOW_START, mins));
  return ((clamped - WINDOW_START) / (WINDOW_END - WINDOW_START)) * 100;
}

export interface WorkingHoursInitial {
  week: Array<{ key: DayKey; isOpen: boolean; open: string; close: string }>;
  slot: 15 | 30 | 60;
  buffer: number;
  minNotice: number;
}

const toHHMM = (t: string) => (t ?? "08:00").slice(0, 5);

export function WorkingHoursView({ initial = null }: { initial?: WorkingHoursInitial | null }) {
  const router = useRouter();
  const { toasts, push } = useToast();
  const baseWeek = initial
    ? initial.week.map((d) => ({ ...DEFAULT_WEEK.find((w) => w.key === d.key)!, isOpen: d.isOpen, open: toHHMM(d.open), close: toHHMM(d.close) }))
    : DEFAULT_WEEK;
  const [week, setWeek] = useState<DayHours[]>(baseWeek);
  const [slot, setSlot] = useState<(typeof SLOT_OPTIONS)[number]>(initial?.slot ?? 30);
  const [buffer, setBuffer] = useState(String(initial?.buffer ?? 0));
  const [minNotice, setMinNotice] = useState(String(initial?.minNotice ?? 2));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await updateWorkingHoursAction({
      weekdays: week.map((d) => ({ weekday: d.key, is_open: d.isOpen, open_time: d.open, close_time: d.close })),
      slotIncrementMin: slot,
      bufferMin: Math.max(0, Number(buffer) || 0),
      minNoticeHours: Math.max(0, Number(minNotice) || 0),
    });
    setSaving(false);
    if (!res.ok) {
      push(res.error.message);
      return;
    }
    push("Working hours saved");
    router.refresh();
  };

  const invalidKeys = useMemo(
    () =>
      new Set(
        week
          .filter((d) => d.isOpen && toMinutes(d.open) >= toMinutes(d.close))
          .map((d) => d.key),
      ),
    [week],
  );
  const hasErrors = invalidKeys.size > 0;

  const updateDay = (key: DayKey, patch: Partial<DayHours>) => {
    setWeek((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const copyMondayTo = (key: DayKey) => {
    const monday = week.find((d) => d.key === "mon");
    if (!monday) return;
    updateDay(key, { isOpen: monday.isOpen, open: monday.open, close: monday.close });
    push("Monday hours copied");
  };

  const applyMondayTo = (keys: DayKey[], label: string) => {
    const monday = week.find((d) => d.key === "mon");
    if (!monday) return;
    setWeek((prev) =>
      prev.map((d) => (keys.includes(d.key) ? { ...d, isOpen: monday.isOpen, open: monday.open, close: monday.close } : d)),
    );
    push(`Monday applied ${label} (demo)`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Working Hours"
        sub="When the business is open — the booking engine respects this for every new reservation, buffer included."
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* Week table */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
              <p className="text-[12px] font-semibold text-obsidian-light">Weekly schedule</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => applyMondayTo(["mon", "tue", "wed", "thu", "fri"], "to all weekdays")} className="btn btn-secondary h-9 px-3 text-[12px]">
                  <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
                  Apply to all weekdays
                </button>
                <button type="button" onClick={() => applyMondayTo(["mon", "tue", "wed", "thu", "fri", "sat"], "to Mon–Sat")} className="btn btn-secondary h-9 px-3 text-[12px]">
                  <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
                  Apply to Mon–Sat
                </button>
              </div>
            </div>

            <div className="hidden grid-cols-[150px_auto_1fr_auto] gap-3 border-b border-divider px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted sm:grid sm:px-5">
              <span>Day</span>
              <span className="w-11">Open</span>
              <span>Hours</span>
              <span className="w-[76px] text-right">Copy</span>
            </div>

            <ul className="divide-y divide-divider">
              {week.map((day) => {
                const invalid = invalidKeys.has(day.key);
                const errorId = `err-${day.key}`;
                return (
                  <li key={day.key} className="px-4 py-3 transition-colors hover:bg-canvas/50 sm:px-5">
                    <div className="grid grid-cols-[110px_auto_1fr_auto] items-center gap-2 sm:grid-cols-[150px_auto_1fr_auto] sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-obsidian">{day.label}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${day.isOpen ? "text-tint-fg-green" : "text-muted"}`}>
                          {day.isOpen ? "Open" : "Closed"}
                        </p>
                      </div>
                      <Switch
                        checked={day.isOpen}
                        onChange={(next) => updateDay(day.key, { isOpen: next })}
                        label={`${day.label} — ${day.isOpen ? "mark closed" : "mark open"}`}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="time"
                          className={`input h-10 w-[6.6rem] px-2 font-mono text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${invalid ? "border-error/60" : ""}`}
                          value={day.open}
                          disabled={!day.isOpen}
                          aria-label={`${day.label} opens at`}
                          aria-invalid={invalid}
                          aria-describedby={invalid ? errorId : undefined}
                          onChange={(e) => updateDay(day.key, { open: e.target.value })}
                        />
                        <span aria-hidden="true" className="text-[12px] font-bold text-muted">→</span>
                        <input
                          type="time"
                          className={`input h-10 w-[6.6rem] px-2 font-mono text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${invalid ? "border-error/60" : ""}`}
                          value={day.close}
                          disabled={!day.isOpen}
                          aria-label={`${day.label} closes at`}
                          aria-invalid={invalid}
                          aria-describedby={invalid ? errorId : undefined}
                          onChange={(e) => updateDay(day.key, { close: e.target.value })}
                        />
                      </div>
                      <div className="flex w-[76px] justify-end">
                        {day.key !== "mon" ? (
                          <button
                            type="button"
                            onClick={() => copyMondayTo(day.key)}
                            className="inline-flex items-center gap-1 rounded-pill border border-border bg-white px-2 py-1.5 text-[10px] font-bold text-obsidian-light transition-colors hover:bg-canvas hover:text-obsidian"
                            title="Copy Monday's hours to this day"
                          >
                            <Copy size={11} strokeWidth={2.2} aria-hidden="true" />
                            Mon
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Source</span>
                        )}
                      </div>
                    </div>
                    {invalid ? (
                      <p id={errorId} role="alert" className="mt-2 flex items-center gap-1.5 pl-[118px] text-[11px] font-semibold text-error sm:pl-[166px]">
                        <CircleExclamationPoint size={12} strokeWidth={2.4} aria-hidden="true" />
                        Opens before it closes — fix {day.label}.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3.5 sm:px-5">
              <p aria-live="polite" className={`flex items-center gap-1.5 text-[11px] font-semibold ${hasErrors ? "text-error" : "text-muted"}`}>
                {hasErrors ? (
                  <>
                    <CircleExclamationPoint size={13} strokeWidth={2.4} aria-hidden="true" />
                    Fix the highlighted rows to save.
                  </>
                ) : (
                  "Opening must be before closing — enforced per row."
                )}
              </p>
              <button type="button" disabled={hasErrors || saving} onClick={save} className="btn btn-primary h-11 disabled:cursor-not-allowed disabled:opacity-40">
                Save hours
              </button>
            </div>
          </div>

          {/* Global booking rules */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-[15px] font-extrabold text-obsidian">Booking rules</h2>
            <p className="mt-0.5 text-[11px] font-medium text-muted">Applied to every new booking, everywhere.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="label" id="slot-label">Slot increment</span>
                <div role="group" aria-labelledby="slot-label" className="segmented">
                  {SLOT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={slot === option}
                      onClick={() => setSlot(option)}
                      className={`segment ${slot === option ? "segment-active" : ""}`}
                    >
                      {option} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="buffer-minutes" className="label">Buffer between bookings</label>
                <div className="relative">
                  <input
                    id="buffer-minutes"
                    type="number"
                    min={0}
                    max={120}
                    className="input h-11 pr-12"
                    value={buffer}
                    onChange={(e) => setBuffer(e.target.value)}
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">min</span>
                </div>
                <p className="mt-1.5 text-[10px] font-medium text-muted">Setup &amp; cleaning time before the next slot</p>
              </div>
              <div>
                <label htmlFor="min-notice" className="label">Minimum notice to book</label>
                <div className="relative">
                  <input
                    id="min-notice"
                    type="number"
                    min={0}
                    max={720}
                    className="input h-11 pr-8"
                    value={minNotice}
                    onChange={(e) => setMinNotice(e.target.value)}
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">h</span>
                </div>
                <p className="mt-1.5 text-[10px] font-medium text-muted">Last-minute bookings closer than this are blocked</p>
              </div>
              <div className="sm:col-span-2">
                <span className="label" id="week-start-label">Week starts on</span>
                <div className="flex items-center gap-2">
                  <input
                    className="input h-11 w-40 cursor-not-allowed bg-canvas text-muted"
                    value="Monday"
                    disabled
                    aria-labelledby="week-start-label"
                  />
                  <span className="chip border border-border bg-canvas text-muted">
                    <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                    Business standard
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <aside className="card p-5 xl:sticky xl:top-5" aria-labelledby="preview-heading">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-tint-blue text-electric">
              <CalendarDays size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <h2 id="preview-heading" className="text-[15px] font-extrabold text-obsidian">Preview — a typical week</h2>
              <p className="text-[11px] font-medium text-muted">Bars render open hours between 07:00 and 21:00</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label="Week preview chart — one bar per open day showing open hours">
            {week.map((day) => {
              const valid = day.isOpen && toMinutes(day.open) < toMinutes(day.close);
              const top = valid ? windowPct(toMinutes(day.open)) : 0;
              const height = valid ? windowPct(toMinutes(day.close)) - windowPct(toMinutes(day.open)) : 0;
              return (
                <div key={day.key} className="flex min-w-0 flex-col items-center gap-1">
                  <span className="font-mono text-[9px] leading-none text-muted">{valid ? day.open : ""}</span>
                  <div className="relative h-44 w-full overflow-hidden rounded-sm border border-divider bg-canvas">
                    {/* faint slot gridlines */}
                    {[12, 18].map((hour) => (
                      <div
                        key={hour}
                        aria-hidden="true"
                        className="absolute inset-x-0 border-t border-dashed border-black/[0.07]"
                        style={{ top: `${(((hour * 60 - WINDOW_START) / (WINDOW_END - WINDOW_START)) * 100).toFixed(2)}%` }}
                      />
                    ))}
                    {valid ? (
                      <div
                        className="absolute inset-x-[5px] rounded-sm bg-electric shadow-electric"
                        style={{
                          top: `${top.toFixed(2)}%`,
                          height: `${Math.max(height, 6).toFixed(2)}%`,
                        }}
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="-rotate-90 whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.18em] text-muted">Closed</span>
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[9px] leading-none text-muted">{valid ? day.close : ""}</span>
                  <span className="text-[11px] font-bold text-obsidian">{day.short}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-divider pt-3 text-[10px] font-medium leading-snug text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-pill bg-electric" aria-hidden="true" />
              Open interval
            </span>
            <span className="font-mono">Africa/Casablanca</span>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[11px] font-medium leading-snug text-tint-fg-blue">
            <Info size={13} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            The grid updates live as you edit — the booking engine will never offer a slot outside these hours.
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            <ArrowRight size={11} strokeWidth={2.4} aria-hidden="true" />
            Slot: {slot} min · buffer {buffer || "0"} min · notice {minNotice || "0"} h
          </p>
        </aside>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
