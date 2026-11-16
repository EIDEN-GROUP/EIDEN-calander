import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NowBarMark } from "@/components/brand/NowBar";

export function EmptyState({
  title,
  description,
  phase,
  children,
}: {
  title: string;
  description: string;
  phase?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-md border border-border bg-white px-6 py-16 text-center shadow-sm">
      <NowBarMark size={56} className="opacity-90" />
      <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.04em] text-obsidian">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-[15px] leading-snug text-obsidian-light">{description}</p>
      {phase && (
        <span className="chip mt-4 border border-electric/20 bg-electric-tint text-[11px] font-bold uppercase tracking-[0.08em] text-electric">
          {t("landsInPhase", { phase })}
        </span>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
