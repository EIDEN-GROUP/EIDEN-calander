"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { Switch } from "@/components/settings/Switch";
import { updateNotificationPrefsAction } from "@/app/actions/settings";

const TRANSACTIONAL = [
  { key: "booking_created", labelKey: "notifBookingCreatedLabel", descKey: "notifBookingCreatedDesc" },
  { key: "booking_updated", labelKey: "notifBookingUpdatedLabel", descKey: "notifBookingUpdatedDesc" },
  { key: "booking_cancelled", labelKey: "notifBookingCancelledLabel", descKey: "notifBookingCancelledDesc" },
  { key: "formation_reminder", labelKey: "notifFormationReminderLabel", descKey: "notifFormationReminderDesc" },
  { key: "change_request_received", labelKey: "notifChangeRequestReceivedLabel", descKey: "notifChangeRequestReceivedDesc" },
  { key: "change_request_approved", labelKey: "notifChangeRequestApprovedLabel", descKey: "notifChangeRequestApprovedDesc" },
  { key: "change_request_declined", labelKey: "notifChangeRequestDeclinedLabel", descKey: "notifChangeRequestDeclinedDesc" },
  { key: "change_request_expired", labelKey: "notifChangeRequestExpiredLabel", descKey: "notifChangeRequestExpiredDesc" },
  { key: "welcome", labelKey: "notifWelcomeLabel", descKey: "notifWelcomeDesc" },
] as const;

type TransactionalKey = (typeof TRANSACTIONAL)[number]["key"];

const DIGEST_SECTIONS = [
  { icon: CalendarDays, titleKey: "digestThisWeekTitle", sampleKey: "digestThisWeekSample" },
  { icon: GraduationCap, titleKey: "digestFormationsFillingTitle", sampleKey: "digestFormationsFillingSample" },
  { icon: ArrowLeftRight, titleKey: "digestChangeRequestsTitle", sampleKey: "digestChangeRequestsSample" },
  { icon: ListChecks, titleKey: "digestUtilizationTitle", sampleKey: "digestUtilizationSample" },
] as const;

export function NotificationsView({
  initialPrefs = null,
  live = false,
}: {
  initialPrefs?: Record<string, boolean> | null;
  live?: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const { toasts, push } = useToast();
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Record<TransactionalKey, boolean>>(() => {
    const base = Object.fromEntries(TRANSACTIONAL.map((t) => [t.key, true])) as Record<TransactionalKey, boolean>;
    if (!initialPrefs) return base;
    for (const key of Object.keys(base) as TransactionalKey[]) {
      if (typeof initialPrefs[key] === "boolean") base[key] = initialPrefs[key];
    }
    return base;
  });

  /** Business-wide switches persist live; enforcement happens server-side before every send. */
  const savePrefs = async () => {
    if (!live) {
      push(t("notifPrefsSavedDemo"));
      return;
    }
    setSavingPrefs(true);
    const res = await updateNotificationPrefsAction(prefs);
    setSavingPrefs(false);
    push(res.ok ? t("notifPrefsSaved") : res.error.message);
    if (res.ok) router.refresh();
  };
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testSending, setTestSending] = useState(false);

  const enabledCount = TRANSACTIONAL.filter((t) => prefs[t.key]).length;

  const setPref = (key: TransactionalKey, next: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: next }));
  };

  /** Real test: POST /api/mail/test-send delivers to your own account email. */
  const sendTest = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/mail/test-send", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; demo?: boolean; sent?: boolean; note?: string; error?: { message?: string } }
        | null;
      if (res.ok && data?.ok) {
        setTestResult(
          data.demo
            ? { ok: true, message: data.note ?? t("demoModeNothingSent") }
            : { ok: true, message: t("testEmailSent") },
        );
      } else {
        setTestResult({ ok: false, message: data?.error?.message ?? t("testFailedStatus", { status: res.status }) });
      }
    } catch {
      setTestResult({ ok: false, message: t("serverUnreachable") });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabNotifications")}
        sub={t("notifSub")}
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
                <h2 id="transactional-heading" className="text-[15px] font-extrabold text-obsidian">{t("transactionalEmailHeading")}</h2>
              </div>
              <p className="text-[11px] font-semibold text-muted"><span className="font-mono text-obsidian">{enabledCount}</span>/{TRANSACTIONAL.length} {t("countOnSuffix")}</p>
            </div>
            <ul className="divide-y divide-divider">
              {TRANSACTIONAL.map(({ key, labelKey, descKey }) => (
                <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-canvas/50 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug text-obsidian">{t(labelKey)}</p>
                    <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">{t(descKey)}</p>
                  </div>
                  <Switch checked={prefs[key]} onChange={(next) => setPref(key, next)} label={t(labelKey)} />
                </li>
              ))}
            </ul>
          </section>

          {/* Digests — ships with v1.1; preview shows the planned contents */}
          <section className="card overflow-hidden opacity-90" aria-labelledby="digest-heading">
            <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3.5 sm:px-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-tint-green text-tint-fg-green">
                <Inbox size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <h2 id="digest-heading" className="text-[15px] font-extrabold text-obsidian">{t("digestsHeading")}</h2>
              <span className="ml-auto inline-flex items-center rounded-pill border border-border bg-canvas px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">v1.1</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p id="digest-pref-label" className="text-[13px] font-semibold text-obsidian">{t("weeklyDigestTitle")}</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">{t("weeklyDigestNote")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewOpen(true)} className="btn btn-secondary h-9 px-3 text-[12px]">
                  {t("previewContents")}
                </button>
                <span className="inline-flex h-7 items-center rounded-pill border border-dashed border-border px-3 text-[11px] font-bold text-muted" aria-label={t("weeklyDigestNotAvailableAria")}>
                  {t("notScheduled")}
                </span>
              </div>
            </div>
          </section>

          {/* Footer actions */}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void sendTest()} disabled={testSending} className="btn btn-secondary h-11 disabled:opacity-60">
                <Send size={15} strokeWidth={2} aria-hidden="true" />
                {testSending ? t("sending") : t("sendTestToMe")}
              </button>
              {testResult ? (
                <p role="status" aria-live="polite" className={`flex items-center gap-1.5 text-[12px] font-semibold ${testResult.ok ? "text-tint-fg-green" : "text-tint-fg-red"}`}>
                  <CircleCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                  {testResult.message}
                </p>
              ) : (
                <p className="text-[11px] font-medium text-muted">{t("testSendNote")}</p>
              )}
            </div>
            <button type="button" onClick={() => void savePrefs()} disabled={savingPrefs} className="btn btn-primary h-11 disabled:opacity-60">
              {savingPrefs ? t("saving") : t("savePreferences")}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">{t("emailOnlyHeading")}</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("whatsappSmsNote")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("pushNotificationsNote")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("sendsLoggedNote")}</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">{t("deliverabilityHeading")}</h2>
            <p className="mt-2 text-[12px] font-medium leading-snug text-obsidian-light">
              {t("deliverabilityNote")}
            </p>
            <Link href="/settings/mail" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-electric hover:text-electric-hover">
              {t("testMailConnection")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[11px] font-medium leading-snug text-tint-fg-blue">
            <Info size={13} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t("categoryOffSilences")}
          </div>
        </aside>
      </div>

      {/* Digest preview modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t("weeklyDigestContentsTitle")}
        description={t("weeklyDigestContentsDesc")}
        footer={<button type="button" onClick={() => setPreviewOpen(false)} className="btn btn-primary h-10 px-6 text-[13px]">{t("closePreview")}</button>}
      >
        <ol className="space-y-3">
          {DIGEST_SECTIONS.map(({ icon: Icon, titleKey, sampleKey }, index) => (
            <li key={titleKey} className="flex items-start gap-3 rounded-sm border border-divider bg-canvas/60 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-white text-electric shadow-sm">
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="text-[12px] font-bold text-obsidian"><span className="font-mono text-muted">{String(index + 1).padStart(2, "0")}</span> · {t(titleKey)}</span>
                <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-muted">{t(sampleKey)}</span>
              </span>
            </li>
          ))}
        </ol>
      </Modal>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
