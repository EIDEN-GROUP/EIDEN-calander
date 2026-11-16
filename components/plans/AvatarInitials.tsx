import { getStaff } from "./demo-staff";

/**
 * AvatarInitials — brand-tint circle with initials. Decorative: the owner
 * name is always rendered as adjacent text, so the avatar is aria-hidden.
 */
export function AvatarInitials({
  id,
  name,
  size = 26,
  className = "",
  unassignedLabel,
}: {
  /** Staff id (resolves via demo directory) — or pass `name` directly. */
  id?: string | null;
  name?: string;
  size?: number;
  className?: string;
  /** Label used when there is no id — defaults to English "Unassigned". */
  unassignedLabel?: string;
}) {
  const resolved = name
    ? { name, initials: name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?", tint: "bg-tint-blue text-tint-fg-blue" }
    : getStaff(id, unassignedLabel);

  return (
    <span
      aria-hidden="true"
      title={resolved.name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-pill font-bold leading-none ${resolved.tint} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
    >
      {resolved.initials}
    </span>
  );
}
