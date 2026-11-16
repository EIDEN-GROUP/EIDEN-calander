import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { DemoNote } from "./DemoNote";

/**
 * Shared header for every settings tab page (and profile):
 * breadcrumb "Settings / {Tab}" + 24px H1 + supporting line + DemoNote pill.
 */
export function PageHeader({
  title,
  sub,
  parent,
  parentHref = "/settings",
  children,
}: {
  title: string;
  sub: string;
  parent?: string;
  parentHref?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("settings");
  const parentLabel = parent ?? t("hubTitle");
  return (
    <div>
      <nav aria-label={t("breadcrumbLabel")} className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        <Link href={parentHref} className="rounded-xs transition-colors hover:text-obsidian">
          {parentLabel}
        </Link>
        <ChevronRight size={12} strokeWidth={2.4} aria-hidden="true" />
        <span aria-current="page" className="text-obsidian-light">
          {title}
        </span>
      </nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-obsidian">
            {title}
          </h1>
          <p className="mt-1 text-[13px] font-medium leading-snug text-obsidian-light">{sub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoNote />
          {children}
        </div>
      </div>
    </div>
  );
}
