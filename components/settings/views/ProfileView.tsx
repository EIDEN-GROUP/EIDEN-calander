"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  Info,
  Lock,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/settings/PageHeader";
import { updateProfileAction, changePasswordAction } from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ToastViewport, useToast } from "@/components/settings/Toast";

type Locale = "en" | "fr";

function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
}

const STRENGTH: Array<{ label: string; bar: string; text: string }> = [
  { label: "Too short", bar: "bg-error", text: "text-error" },
  { label: "Weak", bar: "bg-error", text: "text-error" },
  { label: "Fair", bar: "bg-warning", text: "text-tint-fg-amber" },
  { label: "Strong", bar: "bg-warning", text: "text-tint-fg-amber" },
  { label: "Excellent", bar: "bg-success", text: "text-tint-fg-green" },
];

export interface LiveProfile {
  fullName: string;
  email: string;
  phone: string | null;
  locale: "en" | "fr";
  role: "admin" | "staff";
  memberSince: string | null;
}

export function ProfileView({ firstLogin = false, profile = null }: { firstLogin?: boolean; profile?: LiveProfile | null }) {
  const router = useRouter();
  const { toasts, push } = useToast();
  const initials = (profile?.fullName ?? "MA")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const [name, setName] = useState(profile?.fullName ?? "Marouane A.");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [locale, setLocale] = useState<Locale>(profile?.locale ?? "en");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const score = useMemo(() => passwordScore(newPw), [newPw]);
  const strength = STRENGTH[score];

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPw) {
      setPwError("Enter your current password.");
      return;
    }
    if (newPw.length < 10) {
      setPwError("New password must be at least 10 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New password and confirmation don't match.");
      return;
    }
    setPwError(null);
    const res = await changePasswordAction({ currentPassword: currentPw, newPassword: newPw });
    if (!res.ok) {
      setPwError(res.error.code === "current_password" ? "Your current password is incorrect." : res.error.message);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    push("✓ Password updated — other sessions were revoked.");
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Profile"
        sub="Your account, contact details and password — separate from business settings."
        parent="Settings"
        parentHref="/settings"
      />

      {firstLogin && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-sm border border-warning/50 bg-warning-tint px-4 py-3 text-[13px] font-semibold leading-snug text-[#a34d00]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>
            Welcome to CALENDAR. — your account was created with a temporary password.
            Set your own password below to finish setting up your workspace.
          </span>
        </div>
      )}

      {/* Identity header card */}
      <div className="card mt-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className="flex h-24 w-24 select-none items-center justify-center rounded-pill bg-electric text-[30px] font-extrabold tracking-[-0.02em] text-white shadow-electric ring-4 ring-electric-tint"
          >
            {initials || "MA"}
          </span>
          <button
            type="button"
            onClick={() => push("Avatar upload is coming soon — your initials work great for now")}
            aria-label="Edit avatar"
            className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-white text-obsidian-light shadow-sm transition-all hover:scale-105 hover:text-obsidian"
          >
            <Pencil size={15} strokeWidth={2.1} aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="profile-name" className="sr-only">Full name</label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Full name"
            className="-ml-2 w-full max-w-xs rounded-sm border border-transparent bg-transparent px-2 py-1 text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-obsidian outline-none transition-colors hover:border-border focus:border-electric focus:bg-white"
            autoComplete="name"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="chip bg-obsidian text-[10px] uppercase tracking-[0.12em] text-white">{profile?.role === "admin" ? "Admin" : "Staff"}</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
              <Building2 size={11} strokeWidth={2.2} aria-hidden="true" />
              Eiden Group
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
              <CalendarDays size={11} strokeWidth={2.2} aria-hidden="true" />
              {profile?.memberSince ? "Member since " + new Date(profile.memberSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Member since 2025"}
            </span>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[12px] font-semibold text-obsidian-light">
            <Lock size={12} strokeWidth={2.4} aria-hidden="true" className="text-muted" />
            {profile?.email ?? "—"}
            <span
              title="Managed by your administrator — contact support to change"
              aria-label="Managed by your administrator — contact support to change"
              tabIndex={0}
              role="img"
              className="inline-flex cursor-help items-center text-muted"
            >
              <Info size={13} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Managed by your administrator</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        {/* Contact */}
        <section aria-labelledby="contact-heading" className="card space-y-4 p-5">
          <h2 id="contact-heading" className="text-[15px] font-extrabold text-obsidian">Contact</h2>
          <div>
            <label htmlFor="profile-phone" className="label">Phone</label>
            <input
              id="profile-phone"
              type="tel"
              className="input font-mono text-[13px]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <Phone size={11} strokeWidth={2.2} aria-hidden="true" />
              Used for urgent booking issues only
            </p>
          </div>
          <div>
            <label htmlFor="profile-company" className="label">Company</label>
            <input id="profile-company" className="input cursor-not-allowed bg-canvas text-muted" value="Eiden Group" disabled />
            <p className="mt-1.5 text-[11px] font-medium text-muted">Employer is managed by your administrator</p>
          </div>
          <div className="border-t border-divider pt-3">
            <button
              type="button"
              onClick={async () => {
                const res = await updateProfileAction({ fullName: name.trim(), phone: phone.trim() || null, locale });
                push(res.ok ? "✓ Contact details saved" : res.error.message);
                if (res.ok) router.refresh();
              }}
              className="btn btn-primary h-10 w-full text-[13px]"
            >
              Save contact
            </button>
          </div>
        </section>

        {/* Preferences */}
        <section aria-labelledby="preferences-heading" className="card space-y-4 p-5">
          <h2 id="preferences-heading" className="text-[15px] font-extrabold text-obsidian">Preferences</h2>
          <div>
            <span className="label" id="pref-lang-label">Language</span>
            <div role="group" aria-labelledby="pref-lang-label" className="segmented">
              {(["en", "fr"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)} className={`segment ${locale === l ? "segment-active" : ""}`}>
                  {l === "en" ? "EN" : "FR"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-muted">Overrides the workspace default (/settings/localization)</p>
          </div>
          <div>
            <span className="label" id="pref-theme-label">Theme</span>
            <div role="group" aria-labelledby="pref-theme-label" className="segmented">
              <button type="button" aria-pressed="true" className="segment segment-active cursor-default">Light</button>
              <button type="button" disabled className="segment cursor-not-allowed opacity-50" title="Dark mode is on the roadmap">
                Dark
                <span className="ml-1.5 rounded-pill bg-track px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-muted">Soon</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-muted">Dark mode ships with v1.1</p>
          </div>
          <div>
            <label htmlFor="pref-timezone" className="label">Timezone</label>
            <div className="relative">
              <MapPin size={14} strokeWidth={2.2} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input id="pref-timezone" className="input cursor-not-allowed bg-canvas pl-10 font-mono text-[12px] text-muted" value="Africa/Casablanca" disabled />
            </div>
          </div>
          <div className="border-t border-divider pt-3">
            <button
              type="button"
              onClick={async () => {
                const res = await updateProfileAction({ fullName: name.trim(), phone: phone.trim() || null, locale });
                push(res.ok ? "✓ Preferences saved" : res.error.message);
                if (res.ok) router.refresh();
              }}
              className="btn btn-primary h-10 w-full text-[13px]"
            >
              Save preferences
            </button>
          </div>
        </section>

        {/* Security */}
        <section aria-labelledby="security-heading" className="card space-y-4 p-5 lg:row-span-1">
          <h2 id="security-heading" className="flex items-center gap-2 text-[15px] font-extrabold text-obsidian">
            <ShieldCheck size={17} strokeWidth={2} aria-hidden="true" className="text-electric" />
            Security
          </h2>

          <form onSubmit={submitPassword} className="space-y-3">
            <div>
              <label htmlFor="current-pw" className="label">Current password</label>
              <input id="current-pw" type="password" autoComplete="current-password" className="input h-10 text-[13px]" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwError(null); }} />
            </div>
            <div>
              <label htmlFor="new-pw" className="label">New password</label>
              <div className="relative">
                <input
                  id="new-pw"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  className="input h-10 pr-11 text-[13px]"
                  value={newPw}
                  onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                  aria-describedby="pw-strength"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-pill p-1 text-muted transition-colors hover:text-obsidian"
                >
                  {showPw ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
                </button>
              </div>
              <div id="pw-strength" className="mt-2" aria-live="polite">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {[1, 2, 3, 4].map((segment) => (
                    <span
                      key={segment}
                      className={`h-1.5 flex-1 rounded-pill transition-colors duration-300 ${score >= segment ? strength.bar : "bg-track"}`}
                    />
                  ))}
                </div>
                <p className={`mt-1 text-[10px] font-bold uppercase tracking-[0.1em] ${newPw ? strength.text : "text-muted"}`}>
                  {newPw ? strength.label : "Min. 10 characters"}
                </p>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-pw" className="label">Confirm new password</label>
              <input id="confirm-pw" type="password" autoComplete="new-password" className="input h-10 text-[13px]" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwError(null); }} />
            </div>
            {pwError ? <p role="alert" className="text-[11px] font-semibold text-error">{pwError}</p> : null}
            <button type="submit" className="btn btn-primary h-10 w-full text-[13px]">Update password</button>
          </form>

          <div className="border-t border-divider pt-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Sessions</p>
            <div className="mt-2 flex items-center gap-2 rounded-sm bg-canvas px-3 py-2.5 text-[11px] font-medium leading-snug text-obsidian-light">
              <span className="h-2 w-2 shrink-0 rounded-pill bg-success" aria-hidden="true" />
              This device — MacBook Pro · Casablanca — current session
            </div>
            {confirmSignOut ? (
              <div className="mt-2 space-y-2 rounded-sm border border-error/30 bg-error-tint/60 p-3">
                <p className="text-[11px] font-semibold leading-snug text-obsidian">Sign out everywhere except this device?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const supabase = createClient();
                      if (supabase) await supabase.auth.signOut({ scope: "others" });
                      setConfirmSignOut(false);
                      push("Signed out everywhere else ✓");
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-error px-3 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <LogOut size={12} strokeWidth={2.4} aria-hidden="true" />
                    Sign out
                  </button>
                  <button type="button" onClick={() => setConfirmSignOut(false)} className="btn btn-ghost h-9 px-3 text-[11px]">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-pill border border-error/50 bg-white px-4 text-[12px] font-semibold text-error transition-colors hover:bg-error-tint"
              >
                <LogOut size={14} strokeWidth={2.2} aria-hidden="true" />
                Sign out other sessions
              </button>
            )}
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">Passwords hashed with argon2id once live · sessions in Supabase Auth</p>
          </div>
        </section>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
