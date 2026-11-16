"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, KeyRound, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";


export default function ResetPasswordClient() {
  const t = useTranslations("reset");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase delivers the recovery token in the URL hash; the browser client
  // exchanges it into a session automatically.
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      Promise.resolve().then(() => {
        setReady(true);
        setSessionMissing(true);
      });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSessionMissing(!data.session);
      setReady(true);
    });
  }, []);

  const strongEnough = password.length >= 10 && /[a-zA-Z]/.test(password) && /\d/.test(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!strongEnough) {
      setError(t("weakPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("noMatch"));
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(t("notConfigured"));
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (!updateError) {
      // Kill other sessions; this one stays valid until redirect to login.
      await supabase.auth.signOut({ scope: "others" });
      await supabase.auth.signOut();
    }
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
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

          {done ? (
            <div role="status" className="mt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-success-tint">
                <CheckCircle2 size={24} className="text-tint-fg-green" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.04em] text-obsidian">
                {t("updated")}
              </h1>
              <p className="mt-2 text-[15px] leading-snug text-obsidian-light">
                {t("updatedBody")}
              </p>
              <Link href="/login" className="btn btn-primary mt-6 w-full">
                {t("logIn")}
              </Link>
            </div>
          ) : !ready ? (
            <p className="mt-6 text-[15px] text-obsidian-light">{t("verifying")}</p>
          ) : sessionMissing ? (
            <div role="alert" className="mt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-warning-tint">
                <KeyRound size={24} className="text-tint-fg-amber" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.04em] text-obsidian">
                {t("expired")}
              </h1>
              <p className="mt-2 text-[15px] leading-snug text-obsidian-light">
                {t("expiredBody")}
              </p>
              <Link href="/forgot-password" className="btn btn-primary mt-6 w-full">
                {t("getNewLink")}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.04em] text-obsidian">
                {t("chooseTitle")}
              </h1>
              <p className="mt-2 text-[14px] leading-snug text-obsidian-light">
                {t("chooseBody")}
              </p>

              <form onSubmit={onSubmit} className="mt-6">
                <label htmlFor="password" className="label">
                  {t("newPassword")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? t("hidePassword") : t("showPassword")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-obsidian-light hover:text-obsidian"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {password && (
                  <p className={`mt-2 text-[12px] font-semibold ${strongEnough ? "text-tint-fg-green" : "text-tint-fg-amber"}`}>
                    {strongEnough ? t("strongEnough") : t("needStrong")}
                  </p>
                )}

                <label htmlFor="confirm" className="label mt-4">
                  {t("confirmPassword")}
                </label>
                <input
                  id="confirm"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                />

                {error && (
                  <p role="alert" className="mt-3 flex items-center gap-2 text-[13px] font-medium text-error">
                    <AlertCircle size={15} aria-hidden="true" /> {error}
                  </p>
                )}

                <button type="submit" disabled={pending} className="btn btn-primary mt-5 w-full disabled:opacity-70">
                  {pending ? t("updating") : t("updatePassword")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
