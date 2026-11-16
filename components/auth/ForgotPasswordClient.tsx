"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ChevronLeft, MailCheck, AlertCircle } from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";


export default function ForgotPasswordClient() {
  const t = useTranslations("reset");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setPending(false);
      setError(t("notConfigured"));
      return;
    }

    const redirectTo = `${window.location.origin}/reset-password`;
    // NOTE: always show the neutral success state — never reveal whether an account exists.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setPending(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[420px]">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-obsidian-light transition-colors hover:text-obsidian"
        >
          <ChevronLeft size={17} strokeWidth={2.2} aria-hidden="true" />
          {t("backToLogin")}
        </Link>

        <div className="card mt-6 p-8">
          <NowBarMark size={44} />

          {sent ? (
            <div className="mt-5" role="status">
              <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-success-tint">
                <MailCheck size={24} className="text-tint-fg-green" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.04em] text-obsidian">
                {t("checkInbox")}
              </h1>
              <p className="mt-2 text-[15px] leading-snug text-obsidian-light">
                {t("sentBody", { email })}
              </p>
              <Link href="/login" className="btn btn-primary mt-6 w-full">
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.04em] text-obsidian">
                {t("forgotTitle")}
              </h1>
              <p className="mt-2 text-[15px] leading-snug text-obsidian-light">
                {t("forgotBody")}
              </p>

              <form onSubmit={onSubmit} className="mt-6">
                <label htmlFor="email" className="label">
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@eiden-group.com"
                  className="input"
                />
                {error && (
                  <p role="alert" className="mt-3 flex items-center gap-2 text-[13px] font-medium text-error">
                    <AlertCircle size={15} aria-hidden="true" /> {error}
                  </p>
                )}
                <button type="submit" disabled={pending} className="btn btn-primary mt-5 w-full disabled:opacity-70">
                  {pending ? t("sending") : t("sendLink")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
