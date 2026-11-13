"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Car,
  DoorOpen,
  Hourglass,
  Monitor,
  Plus,
  Presentation,
  Projector,
  Video,
  Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { Switch } from "@/components/settings/Switch";
import { DEMO_ROOMS } from "@/lib/demo-data";

const AMENITIES = [
  { key: "wifi", label: "Wi-Fi", Icon: Wifi },
  { key: "projector", label: "Projector", Icon: Projector },
  { key: "screen", label: "Screen", Icon: Monitor },
  { key: "whiteboard", label: "Whiteboard", Icon: Presentation },
  { key: "videoconf", label: "Videoconf", Icon: Video },
  { key: "parking", label: "Parking", Icon: Car },
] as const;

type AmenityKey = (typeof AMENITIES)[number]["key"];
type RoomLocation = "Casablanca" | "Agadir";

interface RoomVM {
  id: string;
  name: string;
  location: RoomLocation;
  capacity: number;
  hourly_rate: number;
  amenities: AmenityKey[];
  is_active: boolean;
  notes: string;
}

const INITIAL_ROOMS: RoomVM[] = DEMO_ROOMS.map((room) => ({
  id: room.id,
  name: room.name,
  location: room.location === "Agadir" ? "Agadir" : "Casablanca",
  capacity: room.capacity,
  hourly_rate: room.hourly_rate,
  amenities: room.amenities.filter((a): a is AmenityKey => AMENITIES.some((x) => x.key === a)),
  is_active: room.is_active,
  notes: room.notes ?? "",
}));

/** Deterministic demo utilization, 34–85%. */
function utilization(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 34 + (Math.abs(h) % 52);
}

export function RoomsView() {
  const { toasts, push } = useToast();
  const [rooms, setRooms] = useState<RoomVM[]>(INITIAL_ROOMS);
  const [addOpen, setAddOpen] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftLocation, setDraftLocation] = useState<RoomLocation>("Casablanca");
  const [draftCapacity, setDraftCapacity] = useState("10");
  const [draftRate, setDraftRate] = useState("350");
  const [draftAmenities, setDraftAmenities] = useState<AmenityKey[]>(["wifi"]);
  const [draftError, setDraftError] = useState<string | null>(null);

  const anyActive = rooms.some((r) => r.is_active);
  const casaCount = rooms.filter((r) => r.location === "Casablanca").length;
  const agadirCount = rooms.filter((r) => r.location === "Agadir").length;

  const updateRoom = (id: string, patch: Partial<RoomVM>) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleAmenity = (id: string, key: AmenityKey) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, amenities: r.amenities.includes(key) ? r.amenities.filter((a) => a !== key) : [...r.amenities, key] }
          : r,
      ),
    );
  };

  const toggleActive = (id: string) => {
    const current = rooms.find((r) => r.id === id);
    if (!current) return;
    updateRoom(id, { is_active: !current.is_active });
    push(`${current.name.replace(/\s*\(DEMO\)\s*/i, "")} ${current.is_active ? "deactivated" : "activated"} (demo)`);
  };

  const toggleDraftAmenity = (key: AmenityKey) => {
    setDraftAmenities((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key],
    );
  };

  const openAdd = () => {
    setDraftName("");
    setDraftLocation("Casablanca");
    setDraftCapacity("10");
    setDraftRate("350");
    setDraftAmenities(["wifi"]);
    setDraftError(null);
    setAddOpen(true);
  };

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    const capacity = Number(draftCapacity);
    const rate = Number(draftRate);
    if (!name) {
      setDraftError("Give the room a name first.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      setDraftError("Capacity must be at least 1.");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setDraftError("Hourly rate must be 0 or more.");
      return;
    }
    setRooms((prev) => [
      ...prev,
      {
        id: `room-${Date.now().toString(36)}`,
        name,
        location: draftLocation,
        capacity: Math.floor(capacity),
        hourly_rate: Math.round(rate),
        amenities: draftAmenities,
        is_active: true,
        notes: "",
      },
    ]);
    setAddOpen(false);
    push("Room added (demo)");
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Rooms & Resources"
        sub="Capacity, hourly rates and amenities per room. Deactivating hides a room from new bookings instantly."
      >
        <button type="button" onClick={openAdd} className="btn btn-primary h-10 px-4 text-[13px]">
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          Add room
        </button>
      </PageHeader>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div
            role="note"
            className="flex items-start gap-2 rounded-sm border border-warning/30 bg-warning-tint px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-tint-fg-amber"
          >
            <Hourglass size={14} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            True availability per room is coming with working-hours per room (v1.1).
          </div>

          {!anyActive ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center">
              <DoorOpen size={28} strokeWidth={1.6} aria-hidden="true" className="text-muted" />
              <p className="mt-3 text-[14px] font-bold text-obsidian">All rooms are deactivated</p>
              <p className="mt-1 max-w-sm text-[12px] font-medium leading-snug text-muted">
                Nothing can be booked until at least one room is active. Reactivate a room below, or add a new one.
              </p>
              <button type="button" onClick={openAdd} className="btn btn-primary mt-4 h-10 px-4 text-[13px]">
                <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                Add room
              </button>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room) => {
              const util = utilization(room.id);
              const cleanName = room.name.replace(/\s*\(DEMO\)\s*/i, "");
              return (
                <section
                  key={room.id}
                  aria-label={cleanName}
                  className={`card flex flex-col gap-3 p-4 transition-opacity ${room.is_active ? "" : "opacity-70"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-extrabold leading-snug text-obsidian">{room.name}</h2>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                        {room.is_active ? "Bookable" : "Deactivated — hidden from pickers"}
                      </p>
                    </div>
                    <Switch checked={room.is_active} onChange={() => toggleActive(room.id)} label={`${room.is_active ? "Deactivate" : "Activate"} ${cleanName}`} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label htmlFor={`loc-${room.id}`} className="label">Location</label>
                      <select
                        id={`loc-${room.id}`}
                        className="input h-10 px-2.5 text-[13px]"
                        value={room.location}
                        onChange={(e) => updateRoom(room.id, { location: e.target.value as RoomLocation })}
                      >
                        <option value="Casablanca">Casablanca</option>
                        <option value="Agadir">Agadir</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label htmlFor={`cap-${room.id}`} className="label">Capacity</label>
                      <input
                        id={`cap-${room.id}`}
                        type="number"
                        min={1}
                        max={500}
                        className="input h-10 px-2.5 text-[13px]"
                        value={room.capacity}
                        onChange={(e) => updateRoom(room.id, { capacity: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </div>
                    <div className="col-span-1">
                      <label htmlFor={`rate-${room.id}`} className="label">Rate / h</label>
                      <div className="relative">
                        <input
                          id={`rate-${room.id}`}
                          type="number"
                          min={0}
                          step={10}
                          className="input h-10 pl-2.5 pr-9 text-[13px]"
                          value={room.hourly_rate}
                          onChange={(e) => updateRoom(room.id, { hourly_rate: Math.max(0, Number(e.target.value) || 0) })}
                        />
                        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">MAD</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="label" id={`amen-${room.id}`}>Amenities</span>
                    <div role="group" aria-labelledby={`amen-${room.id}`} className="flex flex-wrap gap-1.5">
                      {AMENITIES.map(({ key, label, Icon }) => {
                        const active = room.amenities.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleAmenity(room.id, key)}
                            className={`chip border transition-all ${
                              active
                                ? "border-electric/30 bg-electric-tint text-electric"
                                : "border-border bg-canvas text-muted hover:text-obsidian"
                            }`}
                          >
                            <Icon size={12} strokeWidth={2.1} aria-hidden="true" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`notes-${room.id}`} className="label">Notes</label>
                    <input
                      id={`notes-${room.id}`}
                      className="input h-9 px-3 text-[12px]"
                      placeholder="e.g. Best before a formation day"
                      value={room.notes}
                      onChange={(e) => updateRoom(room.id, { notes: e.target.value })}
                    />
                  </div>

                  <div className="mt-auto border-t border-divider pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Utilization · 90d</span>
                      <span className="font-mono text-[11px] font-semibold text-obsidian">{util}%</span>
                    </div>
                    <div
                      role="img"
                      aria-label={`${cleanName} utilization ${util} percent (demo)`}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-track"
                    >
                      <div className="h-full rounded-pill bg-electric" style={{ width: `${util}%` }} />
                    </div>
                    <Link href="/reports" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-electric hover:text-electric-hover">
                      Open in reports
                      <ArrowRight size={12} strokeWidth={2.4} aria-hidden="true" />
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="flex items-center justify-end border-t border-divider pt-1">
            <button type="button" onClick={() => push("Rooms saved (demo)")} className="btn btn-primary h-11">
              Save changes
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Locations</h2>
            <dl className="mt-3 divide-y divide-divider border-y border-divider">
              {[
                { term: "Casablanca", value: `${casaCount} room${casaCount === 1 ? "" : "s"} — HQ` },
                { term: "Agadir", value: `${agadirCount} room${agadirCount === 1 ? "" : "s"} — satellite` },
              ].map(({ term, value }) => (
                <div key={term} className="grid grid-cols-[104px_1fr] items-baseline gap-3 py-2.5">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{term}</dt>
                  <dd className="text-[12px] font-semibold text-obsidian">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Rates &amp; billing</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Hourly rates exclude VAT — invoices add 20% automatically.</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Rate is snapshotted onto each booking — later price edits never rewrite history.</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Deactivated rooms below stay active in reports and exports.</li>
            </ul>
          </div>
        </aside>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add room"
        description="Available for booking as soon as it is added."
        footer={
          <>
            <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">Cancel</button>
            <button type="submit" form="add-room-form" className="btn btn-primary h-10 px-5 text-[13px]">Add room</button>
          </>
        }
      >
        <form id="add-room-form" onSubmit={submitAdd} className="space-y-4">
          <div>
            <label htmlFor="room-name" className="label">Room name</label>
            <input id="room-name" className="input h-11" value={draftName} onChange={(e) => { setDraftName(e.target.value); setDraftError(null); }} placeholder="e.g. Salle Atlas" autoComplete="off" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor="room-location" className="label">Location</label>
              <select id="room-location" className="input h-11 px-2.5 text-[13px]" value={draftLocation} onChange={(e) => setDraftLocation(e.target.value as RoomLocation)}>
                <option value="Casablanca">Casablanca</option>
                <option value="Agadir">Agadir</option>
              </select>
            </div>
            <div className="col-span-1">
              <label htmlFor="room-capacity" className="label">Capacity</label>
              <input id="room-capacity" type="number" min={1} max={500} className="input h-11 px-2.5 text-[13px]" value={draftCapacity} onChange={(e) => { setDraftCapacity(e.target.value); setDraftError(null); }} />
            </div>
            <div className="col-span-1">
              <label htmlFor="room-rate" className="label">Rate / h</label>
              <div className="relative">
                <input id="room-rate" type="number" min={0} step={10} className="input h-11 pl-2.5 pr-9 text-[13px]" value={draftRate} onChange={(e) => { setDraftRate(e.target.value); setDraftError(null); }} />
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">MAD</span>
              </div>
            </div>
          </div>
          {draftError ? <p role="alert" className="text-[12px] font-semibold text-error">{draftError}</p> : null}
          <div>
            <span className="label" id="room-amenities-label">Amenities</span>
            <div role="group" aria-labelledby="room-amenities-label" className="flex flex-wrap gap-1.5">
              {AMENITIES.map(({ key, label, Icon }) => {
                const active = draftAmenities.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDraftAmenity(key)}
                    className={`chip border transition-all ${
                      active
                        ? "border-electric/30 bg-electric-tint text-electric"
                        : "border-border bg-canvas text-muted hover:text-obsidian"
                    }`}
                  >
                    <Icon size={12} strokeWidth={2.1} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
