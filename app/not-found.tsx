import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Compass } from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";

export const instant = false;

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-12 text-center">
      <NowBarMark size={56} className="opacity-90" />
      <p className="mt-8 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-electric">404</p>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.05em] text-obsidian">{t("title")}</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-snug text-obsidian-light">{t("body")}</p>
      <Link href="/dashboard" className="btn btn-primary mt-6 inline-flex h-11 items-center gap-2">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>
      <p className="mt-6 flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Compass size={12} aria-hidden="true" />
        {t("hint")}
      </p>
    </main>
  );
}
