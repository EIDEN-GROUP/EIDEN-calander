/**
 * Avatar — initials in Obsidian/Electric rotation, or a Building2 glyph for
 * companies. Deterministic rotation via string hash (stable across renders).
 */

import { Building2 } from "lucide-react";

const ROTATION = ["bg-obsidian text-white", "bg-electric text-white", "bg-obsidian-light text-white"] as const;

export function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  kind = "person",
  size = 40,
  className = "",
}: {
  name: string;
  kind?: "person" | "company";
  size?: number;
  className?: string;
}) {
  const tone = ROTATION[hashString(name) % ROTATION.length];
  const fontSize = size >= 56 ? "text-[19px]" : size >= 40 ? "text-[14px]" : "text-[11px]";
  const iconSize = Math.max(16, Math.round(size * 0.46));

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-pill font-bold tracking-wide ${tone} ${fontSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {kind === "company" ? (
        <Building2 size={iconSize} strokeWidth={2} />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </span>
  );
}
