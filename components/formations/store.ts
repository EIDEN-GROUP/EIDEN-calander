/**
 * Formations — demo persistence helpers.
 * Locally created/duplicated formations are kept in sessionStorage so the
 * demo flow survives navigation (list → detail). Exposed to components via
 * useSyncExternalStore (an external system — no setState-in-effect).
 *
 * TODO(WIRE): replace sessionStorage with server-side persistence
 * (app/actions/formations.ts) — this module disappears then.
 */

import type { BookingRow, FormationRow } from "@/lib/types/db";

export interface StoredFormation {
  booking: BookingRow;
  formation: FormationRow;
}

const KEY = "cal-demo-formations";
const CHANGE_EVENT = "cal-demo-formations-changed";

const EMPTY: StoredFormation[] = [];

let cachedRaw: string | null | undefined; // undefined → not read yet this session
let cachedParsed: StoredFormation[] = EMPTY;

function isStoredFormation(value: unknown): value is StoredFormation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.booking === "object" &&
    candidate.booking !== null &&
    typeof candidate.formation === "object" &&
    candidate.formation !== null
  );
}

function parse(raw: string | null): StoredFormation[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const items = parsed.filter(isStoredFormation);
    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function getFormationsSnapshot(): StoredFormation[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedParsed = parse(raw);
    }
    return cachedParsed;
  } catch {
    return EMPTY;
  }
}

export function getServerFormationsSnapshot(): StoredFormation[] {
  return EMPTY;
}

export function subscribeFormations(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readStoredFormations(): StoredFormation[] {
  return getFormationsSnapshot();
}

export function appendStoredFormation(item: StoredFormation): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify([...getFormationsSnapshot(), item]));
  } catch {
    // Quota exceeded — still notify so in-memory demo state stays consistent.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Local ("bk-local-…") formations are created on-device and start with no roster. */
export function isLocalFormationId(id: string): boolean {
  return id.startsWith("bk-local-");
}

/** Trigger a client-side file download (CSV / JSON exports). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
