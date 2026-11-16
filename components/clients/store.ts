/**
 * Clients: demo persistence + download helper.
 * Locally created clients live in sessionStorage; exposed via
 * useSyncExternalStore (an external system: no setState-in-effect).
 *
 * Demo fallback only. Live mode reads/writes via server components + server actions.
 * (app/actions/clients.ts): this module disappears then.
 */

import type { ClientRow } from "@/lib/types/db";

const KEY = "cal-demo-clients";
const CHANGE_EVENT = "cal-demo-clients-changed";

const EMPTY: ClientRow[] = [];

let cachedRaw: string | null | undefined;
let cachedParsed: ClientRow[] = EMPTY;

function isClientRow(value: unknown): value is ClientRow {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.full_name === "string" &&
    typeof candidate.status === "string"
  );
}

function parse(raw: string | null): ClientRow[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const items = parsed.filter(isClientRow);
    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function getClientsSnapshot(): ClientRow[] {
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

export function getServerClientsSnapshot(): ClientRow[] {
  return EMPTY;
}

export function subscribeClients(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readStoredClients(): ClientRow[] {
  return getClientsSnapshot();
}

export function appendStoredClient(client: ClientRow): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify([...getClientsSnapshot(), client]));
  } catch {
    // Quota exceeded: still notify so in-memory demo state stays consistent.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isLocalClientId(id: string): boolean {
  return id.startsWith("cli-local-");
}

/** Trigger a client-side file download (JSON / CSV exports). */
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
