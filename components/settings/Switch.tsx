"use client";

/**
 * Brand-styled toggle switch: a real <button role="switch">.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name, e.g. "Activate category Formation" */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors duration-base disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-electric" : "bg-track"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-pill bg-white shadow-sm transition-all duration-base ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
