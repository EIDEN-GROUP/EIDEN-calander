"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pencil,
  Plus,
  Trash2,
  Pause,
  Play,
  CalendarClock,
  Bookmark,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { BookingRow, BookingStatus } from "@/lib/types/db";
import { shortRef } from "@/components/calendar/calendar-utils";

const STATUS_DOT: Record<BookingStatus, string> = {
  confirmed: "bg-success",
  pending_conflict: "bg-warning",
  paused: "bg-warning",
  cancelled: "bg-black/30",
  completed: "bg-obsidian-light",
};

const MENU_WIDTH = 248;

export interface BookingContextMenuProps {
  x: number;
  y: number;
  booking: BookingRow;
  isPaused: boolean;
  onEdit: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onTogglePause: () => void;
  onPostpone: () => void;
  onClose: () => void;
}

export function BookingContextMenu({
  x,
  y,
  booking,
  isPaused,
  onEdit,
  onAdd,
  onRemove,
  onTogglePause,
  onPostpone,
  onClose,
}: BookingContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Clamp at render time (no post-mount state needed).
  const estimatedHeight = 320;
  const pos = {
    x: Math.min(Math.max(8, x), (typeof window !== "undefined" ? window.innerWidth : 1280) - MENU_WIDTH - 8),
    y: Math.min(Math.max(8, y), (typeof window !== "undefined" ? window.innerHeight : 800) - estimatedHeight - 8),
  };

  const items = useMemo(
    () => [
      { key: "edit", label: "Edit", hint: "Open drawer", icon: Pencil, action: onEdit, tone: "default" as const },
      { key: "add", label: "Add", hint: "New booking right after this", icon: Plus, action: onAdd, tone: "default" as const },
      { key: "postpone", label: "Postpone", hint: "Move to another slot", icon: CalendarClock, action: onPostpone, tone: "default" as const },
      { key: "pause", label: isPaused ? "Resume" : "Pause", hint: isPaused ? "Confirm the booking again" : "Hold it — the room frees up", icon: isPaused ? Play : Pause, action: onTogglePause, tone: "default" as const },
      { key: "remove", label: "Remove", hint: "Cancel — kept in history", icon: Trash2, action: onRemove, tone: "danger" as const },
    ],
    [onEdit, onAdd, onPostpone, isPaused, onTogglePause, onRemove],
  );

  // Dismiss: Escape handled globally; outside click; scroll; resize
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => {
          const delta = e.key === "ArrowDown" ? 1 : -1;
          return (i + delta + items.length) % items.length;
        });
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        items[active].action();
        onClose();
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("mousedown", onPointerDown, { capture: true });
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("mousedown", onPointerDown, { capture: true });
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [active, items, onClose]);

  // Focus the menu for keyboard nav
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${booking.title}`}
      tabIndex={-1}
      className="fixed z-[70] overflow-hidden rounded-md border border-border bg-white shadow-lg outline-none"
      style={{ left: pos.x, top: pos.y, width: MENU_WIDTH, animation: "menuPop 140ms cubic-bezier(.25,1,.5,1)" }}
    >
      {/* Header — context: which booking */}
      <div className="border-b border-divider bg-canvas/60 px-4 pb-2.5 pt-3">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
          <Bookmark size={11} strokeWidth={2.4} aria-hidden="true" />
          Booking · {shortRef(booking.id)}
        </p>
        <p className="mt-1 truncate text-[13px] font-bold text-obsidian" title={booking.title}>
          {booking.title}
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold text-obsidian-light">
          <span className={`h-2 w-2 rounded-pill ${STATUS_DOT[booking.status]}`} aria-hidden="true" />
          {booking.status === "pending_conflict" ? "Pending confirmation" : booking.status === "paused" ? "Paused — room on hold" : booking.status}
        </p>
      </div>

      {/* Actions */}
      <div className="py-1.5" role="group">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === active;
          const danger = item.tone === "danger";
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              data-active={isActive}
              onMouseEnter={() => setActive(index)}
              onClick={() => {
                item.action();
                onClose();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-100 ${
                danger
                  ? isActive
                    ? "bg-error-tint text-error"
                    : "text-error"
                  : isActive
                    ? "bg-electric-tint text-electric"
                    : "text-obsidian"
              }`}
            >
              <Icon size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                <span className={`block text-[10px] font-medium leading-tight ${danger ? "text-error/70" : "text-muted"}`}>
                  {item.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-divider px-4 py-1.5 text-[9.5px] font-medium text-muted">
        Esc to close · ↑↓ to navigate · Enter to run
      </div>
    </div>,
    document.body,
  );
}
