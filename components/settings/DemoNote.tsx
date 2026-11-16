import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Preview data" pill: shown on settings tabs only when the app is NOT
 * connected to a real Supabase project, so admins never think live data
 * is fake, and demo users aren't confused when saves vanish.
 * Decided at build time from the public Supabase URL.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const IS_LIVE = SUPABASE_URL.length > 0 && !/your-|placeholder|change.?me/i.test(SUPABASE_URL);

export function DemoNote() {
  const t = useTranslations("settings");
  if (IS_LIVE) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-warning/40 bg-warning-tint px-2.5 py-1 text-[11px] font-bold text-tint-fg-amber">
      <Info size={12} strokeWidth={2.4} aria-hidden="true" />
      <span className="whitespace-nowrap">{t("demoNoteText")}</span>
    </span>
  );
}
