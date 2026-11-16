"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  CircleExclamationPoint,
  EyeOff,
  Inbox,
  Info,
  LoaderCircle,
  MailCheck,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";

type Protocol = "smtp" | "imap";
type LineState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok" }
  | { status: "error"; message: string };

const PROTOCOLS: Array<{
  key: Protocol;
  labelKey: string;
  host: string;
  port: number;
  icon: typeof Server;
  idleNoteKey: string;
}> = [
  { key: "smtp", labelKey: "protocolSmtpLabel", host: "smtp.hostinger.com", port: 587, icon: Server, idleNoteKey: "notTestedYet" },
  { key: "imap", labelKey: "protocolImapLabel", host: "imap.hostinger.com", port: 993, icon: Inbox, idleNoteKey: "notTestedYet" },
];

export function MailView({ mailboxAddress }: { mailboxAddress: string }) {
  const t = useTranslations("settings");
  const { toasts, push } = useToast();
  const [lines, setLines] = useState<Record<Protocol, LineState>>({
    smtp: { status: "idle" },
    imap: { status: "idle" },
  });

  const runTest = async (protocol: Protocol) => {
    setLines((prev) => ({ ...prev, [protocol]: { status: "testing" } }));
    try {
      const res = await fetch("/api/mail/test");
      let record: Record<string, unknown> | null = null;
      try {
        const data: unknown = await res.json();
        record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
      } catch {
        record = null;
      }
      if (record === null) {
        setLines((prev) => ({ ...prev, [protocol]: { status: "error", message: t("mailTestUnavailable") } }));
        return;
      }
      // Route returns { smtp: { ok, code? }, imap: { ok, code?, message? }, demo? }
      const smtpRec = (record.smtp ?? {}) as Record<string, unknown>;
      const imapRec = (record.imap ?? {}) as Record<string, unknown>;
      const next = (pick: Record<string, unknown>, other: Record<string, unknown>): Record<Protocol, LineState> => ({
        smtp: pick === smtpRec
          ? (smtpRec.ok ? { status: "ok" } : { status: "error", message: typeof smtpRec.code === "string" ? t("smtpCheckFailedCode", { code: smtpRec.code }) : t("smtpCheckFailed") })
          : (other.ok ? { status: "ok" } : { status: "error", message: typeof other.code === "string" ? t("smtpCheckFailedCode", { code: other.code }) : t("smtpCheckFailed") }),
        imap: pick === imapRec
          ? (imapRec.ok ? { status: "ok" } : { status: "error", message: typeof imapRec.message === "string" ? imapRec.message : (typeof imapRec.code === "string" ? t("imapCheckFailedCode", { code: imapRec.code }) : t("imapCheckFailed")) })
          : (other.ok ? { status: "ok" } : { status: "error", message: typeof other.message === "string" ? other.message : (typeof other.code === "string" ? t("imapCheckFailedCode", { code: other.code }) : t("imapCheckFailed")) }),
      });
      setLines(next(protocol === "smtp" ? smtpRec : imapRec, protocol === "smtp" ? imapRec : smtpRec));
      const focusRec = protocol === "smtp" ? smtpRec : imapRec;
      if (focusRec.ok) push(t("protocolVerified", { protocol: protocol.toUpperCase() }));
    } catch {
      setLines((prev) => ({ ...prev, [protocol]: { status: "error", message: t("mailTestUnavailable") } }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabMail")}
        sub={t("mailSub")}
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Account */}
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-tint-blue text-electric">
                <MailCheck size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{t("connectedAccountLabel")}</p>
                <p className="mt-0.5 flex items-center gap-2 font-mono text-[13px] font-semibold text-obsidian">
                  {mailboxAddress}
                  <span title={t("mailboxVisibleTitle")} className="inline-flex items-center text-muted">
                    <EyeOff size={12} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-muted">Hostinger — mail.eiden-group.com</p>
              </div>
            </div>
            <Link href="/inbox" className="btn btn-secondary h-10 px-4 text-[13px]">
              {t("openInbox")}
              <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>

          {/* Protocol rows */}
          <section aria-label={t("mailProtocolStatusAria")} className="card divide-y divide-divider">
            {PROTOCOLS.map(({ key, labelKey, host, port, icon: Icon, idleNoteKey }) => {
              const line = lines[key];
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-canvas text-obsidian-light">
                      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[13px] font-bold text-obsidian">{t(labelKey)}</h2>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted">{host}:{port} · STARTTLS</p>
                      <div aria-live="polite" className="mt-1.5 min-h-[18px]">
                        {line.status === "idle" && (
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-tint-fg-green">
                            <span className="h-2 w-2 rounded-pill bg-success" aria-hidden="true" />
                            {t(idleNoteKey)}
                          </p>
                        )}
                        {line.status === "testing" && (
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                            <LoaderCircle size={12} strokeWidth={2.4} aria-hidden="true" className="animate-spin" />
                            {t("testingProtocol", { protocol: key.toUpperCase() })}
                          </p>
                        )}
                        {line.status === "ok" && (
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-tint-fg-green">
                            <CircleCheck size={13} strokeWidth={2.4} aria-hidden="true" />
                            {t("protocolOk", { protocol: key.toUpperCase() })}
                          </p>
                        )}
                        {line.status === "error" && (
                          <p role="alert" className="flex items-center gap-1.5 text-[11px] font-semibold leading-snug text-error">
                            <CircleExclamationPoint size={13} strokeWidth={2.4} aria-hidden="true" className="shrink-0" />
                            {line.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runTest(key)}
                    disabled={line.status === "testing"}
                    className="btn btn-primary h-10 px-4 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {line.status === "testing" ? t("testing") : t("testProtocol", { protocol: key.toUpperCase() })}
                  </button>
                </div>
              );
            })}
          </section>

          {/* Credentials note */}
          <div className="flex items-start gap-2.5 rounded-sm border border-warning/30 bg-warning-tint px-4 py-3 text-[12px] font-semibold leading-snug text-tint-fg-amber">
            <Info size={15} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {t("credNoteBefore")} <code className="rounded-sm bg-white/60 px-1 font-mono text-[11px]">docs/RUNBOOK.md</code>{t("credNoteAfter")}
            </span>
          </div>

          {/* Security chips */}
          <div className="flex flex-wrap items-center gap-2">
            {["STARTTLS 587", t("chipSpfAligned"), t("chipDkim"), t("chipDmarc"), t("chipFrom")].map((chip) => (
              <span key={chip} className="chip border border-border bg-white text-obsidian-light">
                <ShieldCheck size={11} strokeWidth={2.4} aria-hidden="true" className="text-tint-fg-green" />
                {chip}
              </span>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">{t("howItWorksHeading")}</h2>
            <ol className="mt-3 space-y-3 text-[12px] font-medium leading-snug text-obsidian-light">
              {[
                t("howItWorksStep1"),
                t("howItWorksStep2"),
                t("howItWorksStep3"),
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-canvas font-mono text-[10px] font-bold text-obsidian">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">{t("ifTestFailsHeading")}</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("testFailsRoute")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("testFailsAuth")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("testFailsUnreachable")}</li>
            </ul>
          </div>
        </aside>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
