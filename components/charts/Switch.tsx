"use client";

/**
 * Switch — role="switch" toggle, brand-styled (track fills Electric when on).
 */
export function Switch({
  id,
  checked,
  onChange,
  label,
  caption,
}: {
  id?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  caption?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={caption ? `${label} — ${caption}` : label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-pill transition-colors duration-200 ${
          checked ? "bg-electric" : "bg-track"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-pill bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="flex flex-col leading-tight">
        <span className="text-[13px] font-semibold text-obsidian">{label}</span>
        {caption && (
          <span className="text-[11px] font-medium text-muted">{caption}</span>
        )}
      </span>
    </span>
  );
}
