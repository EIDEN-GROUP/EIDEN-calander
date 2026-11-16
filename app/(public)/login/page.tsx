import type { Metadata } from "next";
import { ChevronLeft, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NowBarMark, Wordmark } from "@/components/brand/NowBar";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("signIn"), description: t("tagline") };
}
// Reads `next` from searchParams at request time.
export const instant = false;

/* ---------- Brand artwork: floating frosted booking cards over the Now-Bar ---------- */

function ArtworkCard({
  time,
  duration,
  title,
  meta,
  accent,
  seats,
  className = "",
  delay = "floaty",
  tx,
}: {
  time: string;
  duration: string;
  title: string;
  meta: string;
  accent: "green" | "blue" | "purple";
  seats?: string;
  className?: string;
  delay?: "floaty" | "floaty-delay" | "floaty-slow";
  tx: (key: string) => string;
}) {
  const accentStyles = {
    green: "bg-tint-green text-tint-fg-green border-[rgba(36,138,61,0.25)]",
    blue: "bg-tint-blue text-tint-fg-blue border-[rgba(0,102,204,0.28)]",
    purple: "bg-tint-purple text-tint-fg-purple border-[rgba(94,92,230,0.28)]",
  }[accent];

  return (
    <div
      className={`${delay} pointer-events-none absolute w-[280px] rounded-md border border-white/70 bg-white/75 p-4 shadow-lg backdrop-blur-xl ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center pt-0.5">
          <span className="text-[15px] font-bold leading-none text-obsidian">{time}</span>
          <span className="mt-1 text-[11px] font-medium text-obsidian-light">{duration}</span>
        </div>
        <div className="min-w-0 border-l border-divider pl-3">
          <span className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${accentStyles}`}>
            {accent === "green" ? "Formation" : accent === "blue" ? "Room rental" : "Internal"}
          </span>
          <p className="mt-1.5 truncate text-[14px] font-bold leading-snug text-obsidian">{title}</p>
          <p className="mt-0.5 truncate text-[12px] font-medium text-obsidian-light">{meta}</p>
          {seats && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-tint-fg-green">
              <Users size={12} strokeWidth={2.4} aria-hidden="true" /> {seats}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandArtwork() {
  const t = useTranslations("login");
  const tx = (key: string) => t(key as Parameters<typeof t>[0]);
  return (
    <div
      aria-hidden="true"
      className="blueprint-grid relative hidden items-center justify-center overflow-hidden bg-canvas lg:flex"
    >
      {/* Oversized Now-Bar motif */}
      <svg
        width="620"
        height="620"
        viewBox="0 0 160 160"
        fill="none"
        className="absolute -left-28 top-1/2 -translate-y-1/2 opacity-[0.96]"
      >
        <path
          d="M 124 32 L 80 32 C 53.4903 32 32 53.4903 32 80 C 32 106.51 53.4903 128 80 128 L 124 128"
          stroke="#1D1D1F"
          strokeWidth="26"
          strokeLinecap="butt"
        />
        <rect x="96" y="52" width="24" height="56" rx="12" fill="#0066CC" />
      </svg>

      {/* Soft radial light behind the artwork */}
      <div className="pointer-events-none absolute right-[-20%] top-[-20%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(0,102,204,0.10)_0%,transparent_65%)]" />
      <div className="pointer-events-none absolute bottom-[-25%] left-[15%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(29,29,31,0.06)_0%,transparent_65%)]" />

      {/* Floating schedule cards */}
      <ArtworkCard
        time="09:30"
        duration={`2${t("hourShort")}`}
        title="React Avancé — Session 3"
        meta="Salle Formation · Casablanca"
        accent="green"
        seats={`14 / 20 ${t("seats")}`}
        className="right-[14%] top-[16%] rotate-[1.5deg]"
        delay="floaty"
        tx={tx}
      />
      <ArtworkCard
        time="14:00"
        duration={`3${t("hourShort")}`}
        title="Acme SARL — Board Meeting"
        meta="Salle Grande · 450 MAD / h"
        accent="blue"
        className="right-[30%] top-[42%] -rotate-[2deg]"
        delay="floaty-delay"
        tx={tx}
      />
      <ArtworkCard
        time="17:30"
        duration={`45${t("minuteShort")}`}
        title="Revue produit — Équipe"
        meta="Salle Petite · Agadir"
        accent="purple"
        className="right-[10%] bottom-[15%] rotate-[1deg]"
        delay="floaty-slow"
        tx={tx}
      />

      {/* Wordmark block, bottom-left */}
      <div className="absolute bottom-10 left-12">
        <Wordmark className="text-[28px]" />
        <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-obsidian-light">
          Architecture for Time.
        </p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-black/35">
          Eiden Group · eiden-group.com
        </p>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("login");
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/dashboard";

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <BrandArtwork />

      {/* Right panel */}
      <div className="relative flex flex-col bg-white">
        {/* Mobile artwork banner (Image 3 adaptation) */}
        <div className="blueprint-grid relative flex h-40 items-center justify-center overflow-hidden bg-canvas lg:hidden">
          <svg
            width="300"
            height="300"
            viewBox="0 0 160 160"
            fill="none"
            className="absolute left-1/2 top-2 -translate-x-1/2"
            aria-hidden="true"
          >
            <path
              d="M 124 32 L 80 32 C 53.4903 32 32 53.4903 32 80 C 32 106.51 53.4903 128 80 128 L 124 128"
              stroke="#1D1D1F"
              strokeWidth="24"
              strokeLinecap="butt"
            />
            <rect x="96" y="52" width="24" height="56" rx="12" fill="#0066CC" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-[460px]">
            {/* Back to website */}
            <a
              href="https://eiden-group.com"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-obsidian-light transition-colors hover:text-obsidian"
            >
              <ChevronLeft size={17} strokeWidth={2.2} aria-hidden="true" />
              {t("backToWebsite")}
            </a>

            {/* Brand */}
            <div className="mt-10 flex items-center gap-3">
              <NowBarMark size={44} />
              <Wordmark className="text-[24px]" />
            </div>

            {/* Headline */}
            <h1 className="mt-6 text-[38px] font-extrabold leading-[1.05] tracking-[-0.05em] text-obsidian sm:text-[44px]">
              {t("welcome")}
            </h1>
            <p className="mt-3 text-[16px] leading-snug text-obsidian-light">
              {t("tagline")}
            </p>
            <p className="mt-2 text-[13px] text-black/45">
              {t("needAccess")}
            </p>

            {/* Form */}
            <div className="mt-8">
              <LoginForm nextPath={nextPath} />
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div className="flex items-center justify-between gap-4 border-t border-divider px-6 py-4 text-[11px] font-medium text-black/40 sm:px-10">
          <span>{t("rights")}</span>
          <span className="font-mono uppercase tracking-[0.14em]">Architecture for Time.</span>
        </div>
      </div>
    </div>
  );
}
