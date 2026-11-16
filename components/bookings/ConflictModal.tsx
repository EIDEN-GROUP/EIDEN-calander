"use client";

import { useRef } from "react";
import { ChevronRight, TriangleAlert, X } from "lucide-react";
import { useModalA11y } from "./focus-trap";
import { formatTimeRange } from "@/components/calendar/calendar-utils";

export interface ConflictClash {
  id: string;
  title: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  requestedBy: string; // display name of the incumbent creator
}

export interface ConflictSuggestion {
  startsAt: string;
  endsAt: string;
  label: string; // e.g. "Today · 16:30"
}

interface ConflictModalProps {
  roomName: string;
  conflicts: ConflictClash[];
  suggestions: ConflictSuggestion[];
  onClose: () => void;
  onPickSuggestion: (s: ConflictSuggestion) => void;
  onRequestChange: () => void;
}

/**
 * Standalone "This slot is taken" modal.
 * Used by the booking drawer for the full-screen conflict treatment.
 * Preview is client-side against loaded bookings (live or demo).
 * Submit path goes through server actions (createBookingAction / requestChangeAction).
 */
export function ConflictModal({
  roomName,
  conflicts,
  suggestions,
  onClose,
  onPickSuggestion,
  onRequestChange,
}: ConflictModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-obsidian/35 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-modal-title"
        aria-describedby="conflict-modal-desc"
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-md bg-surface p-6 shadow-lg sm:max-w-md sm:rounded-md"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-black/[0.04] hover:text-obsidian"
        >
          <X size={17} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-warning-tint">
          <TriangleAlert size={24} strokeWidth={2} className="text-warning" aria-hidden="true" />
        </div>

        <h2
          id="conflict-modal-title"
          className="mt-4 text-[21px] font-extrabold leading-tight tracking-[-0.02em] text-obsidian"
        >
          This slot is taken
        </h2>
        <p id="conflict-modal-desc" className="mt-1.5 text-[14px] leading-snug text-obsidian-light">
          {roomName} is already booked during this window:
        </p>

        {/* Clash list */}
        <ul className="mt-4 space-y-2" aria-label="Conflicting bookings">
          {conflicts.map((c) => (
            <li
              key={c.id}
              className="rounded-sm border border-warning/40 bg-warning-tint px-3.5 py-2.5"
            >
              <span className="block text-[13px] font-bold leading-snug text-obsidian">
                {c.title}
              </span>
              <span className="mt-0.5 block text-[12px] font-medium text-obsidian-light">
                {formatTimeRange(new Date(c.startsAt), new Date(c.endsAt))} · held by{" "}
                {c.requestedBy}
              </span>
            </li>
          ))}
        </ul>

        {/* Suggested slots */}
        {suggestions.length > 0 && (
          <div className="mt-4">
            <p className="label !mb-2">Suggested slots</p>
            <ul className="flex flex-wrap gap-2" aria-label="Suggested alternative slots">
              {suggestions.map((s) => (
                <li key={s.startsAt}>
                  <button
                    type="button"
                    onClick={() => onPickSuggestion(s)}
                    title={`${formatTimeRange(new Date(s.startsAt), new Date(s.endsAt))}`}
                    className="chip border border-electric/25 bg-electric-tint text-[12px] text-electric transition-all hover:-translate-y-px hover:bg-electric-tint-strong"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary h-11">
            Cancel
          </button>
          <button
            type="button"
            onClick={onRequestChange}
            className="btn btn-primary h-11"
          >
            Request change
            <ChevronRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
