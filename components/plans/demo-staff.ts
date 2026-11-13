/**
 * Demo staff directory — the four selectable demo users.
 * TODO(WIRE): replace with profiles table lookup via server components once
 * Supabase is connected (owner_id / assignee_id foreign keys already match).
 */

export interface DemoStaffMember {
  id: string;
  /** Display name, EN style first name. */
  name: string;
  role: "Admin" | "Staff";
  /** Avatar tint pair (bg + fg) — brand tint presets only. */
  tint: string;
}

export const DEMO_STAFF: DemoStaffMember[] = [
  { id: "marouane", name: "Marouane", role: "Admin", tint: "bg-tint-blue text-tint-fg-blue" },
  { id: "yasmine", name: "Yasmine", role: "Staff", tint: "bg-tint-purple text-tint-fg-purple" },
  { id: "karim", name: "Karim", role: "Staff", tint: "bg-tint-green text-tint-fg-green" },
  { id: "demo-admin", name: "Demo Admin", role: "Admin", tint: "bg-tint-teal text-tint-fg-teal" },
  { id: "demo-staff", name: "Demo Staff", role: "Staff", tint: "bg-tint-amber text-tint-fg-amber" },
];

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const FALLBACK_TINTS = [
  "bg-tint-blue text-tint-fg-blue",
  "bg-tint-green text-tint-fg-green",
  "bg-tint-purple text-tint-fg-purple",
  "bg-tint-amber text-tint-fg-amber",
  "bg-tint-teal text-tint-fg-teal",
];

export interface ResolvedStaff {
  id: string | null;
  name: string;
  initials: string;
  tint: string;
}

/** Resolve an id from demo bookings/plans to a display identity. Unknown ids degrade to their raw value, never crash. */
export function getStaff(id: string | null | undefined): ResolvedStaff {
  if (!id) {
    return { id: null, name: "Unassigned", initials: "–", tint: "bg-track text-muted" };
  }
  const known = DEMO_STAFF.find((m) => m.id === id);
  if (known) {
    return { id, name: known.name, initials: initialsOf(known.name), tint: known.tint };
  }
  // Unknown (e.g. "demo-admin" legacy) — stable tint from hash, raw id as name.
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const tint = FALLBACK_TINTS[Math.abs(h) % FALLBACK_TINTS.length];
  const name = id
    .replace(/^demo-/, "Demo ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { id, name, initials: initialsOf(name), tint };
}
