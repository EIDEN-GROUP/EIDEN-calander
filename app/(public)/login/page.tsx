import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/NowBar";
import { LoginMosaic } from "@/components/auth/LoginMosaic";
import { LoginForm } from "./LoginForm";
import "./login-page.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("signIn"), description: t("tagline") };
}
// Reads `next` from searchParams at request time.
export const instant = false;

/* ---------- Brand lockup: Now-Bar pill (pulsing) + wordmark ---------- */

function BrandLockup({ delay }: { delay: string }) {
  return (
    <div
      className="login-stagger mt-9 flex items-center gap-2.5"
      style={{ "--stagger-delay": delay } as CSSProperties}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 160 160"
        fill="none"
        role="img"
        aria-label="CALENDAR."
      >
        <path
          d="M 124 32 L 80 32 C 53.4903 32 32 53.4903 32 80 C 32 106.51 53.4903 128 80 128 L 124 128"
          stroke="#1D1D1F"
          strokeWidth="32"
          strokeLinecap="butt"
        />
        <rect
          className="login-now-bar-pill"
          x="96"
          y="52"
          width="24"
          height="56"
          rx="12"
          fill="#0066CC"
        />
      </svg>
      <Wordmark className="text-[19px]" />
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
    <main className="flex min-h-dvh items-stretch justify-center bg-canvas md:p-5">
      {/* Auth shell — 1360px max, rounded white card, 1fr/1fr */}
      <div className="grid min-h-dvh w-full max-w-[1360px] grid-cols-1 overflow-hidden bg-white md:min-h-[calc(100dvh-40px)] md:grid-cols-2 md:rounded-lg md:border md:border-border md:shadow-lg">
        {/* LEFT — “Ashlar” mosaic */}
        <LoginMosaic />

        {/* RIGHT — sign-in */}
        <section className="relative flex flex-col justify-center bg-white">
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
            <div className="w-full max-w-[400px]">
              {/* Back to website */}
              <a
                href="https://eiden-group.com"
                className="login-stagger inline-flex items-center gap-1.5 text-[14px] font-medium text-obsidian-light transition-[color,transform] duration-200 hover:-translate-x-[3px] hover:text-electric"
                style={{ "--stagger-delay": "60ms" } as CSSProperties}
              >
                <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                {t("backToWebsite")}
              </a>

              {/* Brand lockup */}
              <BrandLockup delay="120ms" />

              {/* Headline + subtext */}
              <h1
                className="login-stagger mt-6 text-[40px] font-bold leading-[1.12] tracking-[-0.05em] text-obsidian sm:text-[44px]"
                style={{ "--stagger-delay": "180ms" } as CSSProperties}
              >
                {t("welcome")}
              </h1>
              <p
                className="login-stagger mt-2.5 text-[15px] leading-snug text-obsidian-light"
                style={{ "--stagger-delay": "240ms" } as CSSProperties}
              >
                {t("tagline")}
              </p>
              <p
                className="login-stagger mt-2 text-[13px] text-black/45"
                style={{ "--stagger-delay": "250ms" } as CSSProperties}
              >
                {t("needAccess")}
              </p>

              {/* Form */}
              <div
                className="login-stagger mt-7"
                style={{ "--stagger-delay": "300ms" } as CSSProperties}
              >
                <LoginForm nextPath={nextPath} />
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div
            className="login-stagger flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-divider px-6 py-4 text-[11px] font-medium text-black/40 sm:px-10"
            style={{ "--stagger-delay": "360ms" } as CSSProperties}
          >
            <span>{t("rights")}</span>
            <span className="font-mono uppercase tracking-[0.14em]">Architecture for Time.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
