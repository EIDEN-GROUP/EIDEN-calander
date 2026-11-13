"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { useModalA11y } from "@/components/bookings/focus-trap";
import { Switch } from "@/components/charts/Switch";
import { DEMO_STAFF } from "./demo-staff";
import type { ResolvedStaff } from "./demo-staff";
import type { PlanPriority, PlanStatus } from "@/lib/types/db";

const STATUS_OPTIONS: Array<{ value: PlanStatus; label: string }> = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_OPTIONS: Array<{ value: PlanPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export interface NewPlanDraft {
  title: string;
  description: string;
  owner_id: string;
  status: PlanStatus;
  priority: PlanPriority;
  start_date: string | null;
  target_date: string | null;
  target_date_marker: boolean;
}

/**
 * Inline "New plan" dialog. Title required; target before start is rejected
 * inline. Escape / overlay click closes; focus trapped while open.
 */
export function NewPlanModal({
  onClose,
  onCreate,
  members = DEMO_STAFF,
}: {
  onClose: () => void;
  onCreate: (draft: NewPlanDraft) => void;
  members?: Array<{ id: string; name: string }>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onClose);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("marouane");
  const [status, setStatus] = useState<PlanStatus>("planning");
  const [priority, setPriority] = useState<PlanPriority>("medium");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [touched, setTouched] = useState(false);

  const dateRangeError =
    startDate && targetDate && targetDate < startDate
      ? "Target date is before the start date."
      : null;
  const titleError = touched && !title.trim() ? "Give the plan a title." : null;
  const canSubmit = title.trim().length > 0 && !dateRangeError;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setTouched(true);
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim(),
      owner_id: ownerId,
      status,
      priority,
      start_date: startDate || null,
      target_date: targetDate || null,
      target_date_marker: showOnCalendar && Boolean(targetDate),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-obsidian/35 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-plan-heading"
        className="relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-md border border-border bg-white p-5 shadow-lg sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="new-plan-heading"
              className="text-[18px] font-extrabold tracking-[-0.02em] text-obsidian"
            >
              New plan
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-muted">
              A strategic objective with an owner and a date — no meeting required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-canvas hover:text-obsidian"
          >
            <X size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          {/* Title */}
          <div>
            <label htmlFor="plan-title" className="label">
              Plan title
            </label>
            <input
              id="plan-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Open Agadir second location"
              className="input"
              aria-invalid={Boolean(titleError) || undefined}
              aria-describedby={titleError ? "plan-title-error" : undefined}
            />
            {titleError && (
              <p id="plan-title-error" role="alert" className="mt-1.5 text-[11px] font-semibold text-error">
                {titleError}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="plan-description" className="label">
              Description <span className="font-semibold normal-case text-muted">(optional)</span>
            </label>
            <textarea
              id="plan-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does done look like?"
              className="input h-auto min-h-[64px] resize-y py-3"
            />
          </div>

          {/* Owner + status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-owner" className="label">
                Owner
              </label>
              <select
                id="plan-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="input"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="plan-status" className="label">
                Status
              </label>
              <select
                id="plan-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanStatus)}
                className="input"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority + dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-priority" className="label">
                Priority
              </label>
              <select
                id="plan-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PlanPriority)}
                className="input"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div aria-hidden="true" />
            <div>
              <label htmlFor="plan-start" className="label">
                Start date
              </label>
              <input
                id="plan-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="plan-target" className="label">
                Target date
              </label>
              <input
                id="plan-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="input font-mono tabular-nums"
                aria-invalid={Boolean(dateRangeError) || undefined}
                aria-describedby={dateRangeError ? "plan-date-error" : undefined}
              />
            </div>
          </div>
          {dateRangeError && (
            <p id="plan-date-error" role="alert" className="-mt-2 text-[11px] font-semibold text-error">
              {dateRangeError}
            </p>
          )}

          {/* Show on calendar toggle */}
          <div className="flex items-center justify-between gap-4 rounded-sm border border-border bg-canvas/60 px-4 py-3">
            <Switch
              id="plan-marker"
              checked={showOnCalendar}
              onChange={setShowOnCalendar}
              label="Show on calendar"
              caption="Diamond marker on the calendar at target date"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 border-t border-divider pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary h-10 px-5 text-[13px]">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit} className="btn btn-primary h-10 px-5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50">
              Create plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
