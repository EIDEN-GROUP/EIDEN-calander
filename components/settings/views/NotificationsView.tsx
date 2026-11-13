"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  CircleCheck,
  GraduationCap,
  Inbox,
  Info,
  ListChecks,
  Mail,
  Send,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { Switch } from "@/components/settings/Switch";

const TRANSACTIONAL = [
  { key: "booking_created", label: "Booking created", desc: "Client and team both get a confirmation email." },
  { key: "booking_updated", label: "Booking updated", desc: "Time, room or details changed — both sides are emailed." },
  { key: "booking_cancelled", label: "Booking cancelled", desc: "Cancellation notice with reason and next steps." },
  { key: "formation_reminder", label: "Formation D-1 reminder", desc: "Sent 09:00 the day before a session — room, time, what to bring." },
  { key: "change_request_received", label: "Change request received", desc: "Staff moved to resolve a conflict — admins are emailed." },
  { key: "change_request_approved", label: "Change request approved", desc: "The requester gets the confirmed new slot in writing." },
  { key: "change_request_declined", label: "Change request declined", desc: "Polite decline with the admin's message attached." },
  { key: "change_request_expired", label: "Change request expired", desc: "No decision before expiry — the requester is nudged automatically." },
  { key: "welcome", label: "Welcome + temp password", desc: "Sent once on user creation — includes first-login instructions." },
] as const;

type TransactionalKey = (typeof TRANSACTIONAL)[number]["key"];

const DIGEST_SECTIONS = [
  { icon: CalendarDays, title: "This week's bookings", sample: "Salle Grande ×4 · Salle Formation ×2 · Salle Petite ×3 — grouped per room" },
  { icon: GraduationCap, title: "Formations filling up", sample: "React Avancé — Session 4 · 19/20 seats · 1 on the waitlist" },
  { icon: ArrowLeftRight, title: "Change requests awaiting you", sample: "2 pending · oldest: ONCF steering — expires Thursday 00:00" },
  { icon: ListChecks, title: "Utilization snapshot", sample: "Casablanca 71% · Agadir 38% — vs 90-day average" },
] as const;

export function NotificationsView() {
  const { toasts, push } = useToast();
  const [prefs, setPrefs] = useState<Record<TransactionalKey, boolean>>(
    () => Object.fromEntries(TRANSACTIONAL.map((t) => [t.key, true])) as Record<TransactionalKey, boolean>,
  );
  const [digest, setDigest] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ latency: number } | null>(null);

  const enabledCount = TRANSACTIONAL.filter((t) => prefs[t.key]).length;

  const setPref = (key: TransactionalKey, next: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: next }));
  };

  const sendTest = () => {
    setTestResult({ latency: Math.round(120 + Math.random() * 380) });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Notifications"
        sub="Which transactional emails go out, and what lands in Monday's digest. Everything else stays silent."
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Transactional email */}
          <section className="card overflow-hidden" aria-labelledby="transactional-heading">
            <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-tint-blue text-electric">
                  <Mail size={16} strokeWidth={2} aria-hidden="true" />
                </span>
                <h2 id="transactional-heading" className="text-[15px] font-extrabold text-obsidian">Transactional email</h2>
              </div>
              <p className="text-[11px] font-semibold text-muted"><span className="font-mono text-obsidian">{enabledCount}</span>/{TRANSACTIONAL.length} on</p>
            </div>
            <ul className="divide-y divide-divider">
              {TRANSACTIONAL.map(({ key, label, desc }) => (
                <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-canvas/50 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug text-obsidian">{label}</p>
                    <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">{desc}</p>
                  </div>
                  <Switch checked={prefs[key]} onChange={(next) => setPref(key, next)} label={label} />
                </li>
              ))}
            </ul>
          </section>

          {/* Digests */}
          <section className="card overflow-hidden" aria-labelledby="digest-heading">
            <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5 sm:px-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-tint-green text-tint-fg-green">
                <Inbox size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <h2 id="digest-heading" className="text-[15px] font-extrabold text-obsidian">Digests</h2>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p id="digest-pref-label" className="text-[13px] font-semibold text-obsidian">Weekly digest — Monday 08:00</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">One email each Monday morning. Casablanca time. Replaces the Thursday recap.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewOpen(true)} className="btn btn-secondary h-9 px-3 text-[12px]">
                  Preview contents
                </button>
                <Switch checked={digest} onChange={setDigest} label="Weekly digest — Monday 08:00" />
              </div>
            </div>
          </section>

          {/* Footer actions */}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={sendTest} className="btn btn-secondary h-11">
                <Send size={15} strokeWidth={2} aria-hidden="true" />
                Send test email to me
              </button>
              {testResult ? (
                <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-[12px] font-semibold text-tint-fg-green">
                  <CircleCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                  Test sent (demo) — delivered in {testResult.latency} ms
                </p>
              ) : (
                <p className="text-[11px] font-medium text-muted">Delivered to contact@eiden-group.com</p>
              )}
            </div>
            <button type="button" onClick={() => push("Notification preferences saved (demo)")} className="btn btn-primary h-11">
              Save preferences
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Email only, for now</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />WhatsApp and SMS go out once the provider is signed — same triggers.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Push notifications pair with the v1.1 room-availability release.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Every send is logged to the audit trail — open rates are not tracked, by policy.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Deliverability</h2>
            <p className="mt-2 text-[12px] font-medium leading-snug text-obsidian-light">
              Sends route through Hostinger SMTP (smtp.hostinger.com:587). Credentials live in Vercel environment variables — never in this page.
            </p>
            <Link href="/settings/mail" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-electric hover:text-electric-hover">
              Test the mail connection
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[11px] font-medium leading-snug text-tint-fg-blue">
            <Info size={13} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            Turning a category off here only silences email — in-app notifications always show.
          </div>
        </aside>
      </div>

      {/* Digest preview modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Weekly digest — contents"
        description="Four sections, same order every Monday, rendered from live data once Supabase is connected."
        footer={<button type="button" onClick={() => setPreviewOpen(false)} className="btn btn-primary h-10 px-6 text-[13px]">Close preview</button>}
      >
        <ol className="space-y-3">
          {DIGEST_SECTIONS.map(({ icon: Icon, title, sample }, index) => (
            <li key={title} className="flex items-start gap-3 rounded-sm border border-divider bg-canvas/60 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-white text-electric shadow-sm">
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="text-[12px] font-bold text-obsidian"><span className="font-mono text-muted">{String(index + 1).padStart(2, "0")}</span> · {title}</span>
                <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-muted">{sample}</span>
              </span>
            </li>
          ))}
        </ol>
      </Modal>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
