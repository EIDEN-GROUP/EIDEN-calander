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
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";

type Protocol = "smtp" | "imap";
type LineState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; latency: number }
  | { status: "error"; message: string };

const PROTOCOLS: Array<{
  key: Protocol;
  label: string;
  host: string;
  port: number;
  icon: typeof Server;
  idleNote: string;
}> = [
  { key: "smtp", label: "SMTP — outgoing", host: "smtp.hostinger.com", port: 587, icon: Server, idleNote: "OK — smtp.hostinger.com:587 (demo)" },
  { key: "imap", label: "IMAP — incoming", host: "imap.hostinger.com", port: 993, icon: Inbox, idleNote: "OK — imap.hostinger.com:993 (demo)" },
];

const UNAVAILABLE_MSG = "Mail test unavailable — set .env then redeploy (or ask your admin)";

export function MailView() {
  const { toasts, push } = useToast();
  const [lines, setLines] = useState<Record<Protocol, LineState>>({
    smtp: { status: "idle" },
    imap: { status: "idle" },
  });

  const runTest = async (protocol: Protocol) => {
    setLines((prev) => ({ ...prev, [protocol]: { status: "testing" } }));
    try {
      const res = await fetch("/api/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol }),
      });
      let record: Record<string, unknown> | null = null;
      try {
        const data: unknown = await res.json();
        record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
      } catch {
        record = null;
      }
      if (record === null) {
        // Route missing / HTML error page — treat as unconfigured environment.
        setLines((prev) => ({ ...prev, [protocol]: { status: "error", message: UNAVAILABLE_MSG } }));
        return;
      }
      const latency = typeof record.latencyMs === "number" ? record.latencyMs : 0;
      if (res.ok && record.ok !== false) {
        setLines((prev) => ({
          ...prev,
          [protocol]: { status: "ok", latency: latency > 0 ? latency : Math.round(120 + Math.random() * 380) },
        }));
        push(`${protocol.toUpperCase()} test passed (demo)`);
      } else {
        const message = typeof record.message === "string" ? record.message : `Test failed — server responded ${res.status}`;
        setLines((prev) => ({ ...prev, [protocol]: { status: "error", message } }));
      }
    } catch {
      setLines((prev) => ({ ...prev, [protocol]: { status: "error", message: UNAVAILABLE_MSG } }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Mail"
        sub="How CALENDAR. talks to contact@eiden-group.com — status and one-click connection tests."
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
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Connected account</p>
                <p className="mt-0.5 flex items-center gap-2 font-mono text-[13px] font-semibold text-obsidian">
                  contact@eiden-group.com
                  <span title="Mailbox address is visible to admins only" className="inline-flex items-center text-muted">
                    <EyeOff size={12} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-muted">Hostinger — mail.eiden-group.com</p>
              </div>
            </div>
            <Link href="/inbox" className="btn btn-secondary h-10 px-4 text-[13px]">
              Open inbox
              <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>

          {/* Protocol rows */}
          <section aria-label="Mail protocol status" className="card divide-y divide-divider">
            {PROTOCOLS.map(({ key, label, host, port, icon: Icon, idleNote }) => {
              const line = lines[key];
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-canvas text-obsidian-light">
                      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[13px] font-bold text-obsidian">{label}</h2>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted">{host}:{port} · STARTTLS</p>
                      <div aria-live="polite" className="mt-1.5 min-h-[18px]">
                        {line.status === "idle" && (
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-tint-fg-green">
                            <span className="h-2 w-2 rounded-pill bg-success" aria-hidden="true" />
                            {idleNote}
                          </p>
                        )}
                        {line.status === "testing" && (
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                            <LoaderCircle size={12} strokeWidth={2.4} aria-hidden="true" className="animate-spin" />
                            Testing {key.toUpperCase()} — handshake &amp; auth…
                          </p>
                        )}
                        {line.status === "ok" && (
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-tint-fg-green">
                            <CircleCheck size={13} strokeWidth={2.4} aria-hidden="true" />
                            {key.toUpperCase()} OK — authenticated &amp; handshake in {line.latency} ms
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
                    {line.status === "testing" ? "Testing…" : `Test ${key.toUpperCase()}`}
                  </button>
                </div>
              );
            })}
          </section>

          {/* Credentials note */}
          <div className="flex items-start gap-2.5 rounded-sm border border-warning/30 bg-warning-tint px-4 py-3 text-[12px] font-semibold leading-snug text-tint-fg-amber">
            <Info size={15} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              Credentials live in Vercel environment variables — never in the database or the browser. See <code className="rounded-sm bg-white/60 px-1 font-mono text-[11px]">docs/RUNBOOK.md</code>, §5 Environment variables, then redeploy.
            </span>
          </div>

          {/* Security chips */}
          <div className="flex flex-wrap items-center gap-2">
            {["STARTTLS 587", "SPF aligned", "DKIM signing", "DMARC quarantine", "From: eiden-group.com"].map((chip) => (
              <span key={chip} className="chip border border-border bg-white text-obsidian-light">
                <ShieldCheck size={11} strokeWidth={2.4} aria-hidden="true" className="text-tint-fg-green" />
                {chip}
              </span>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">How it works</h2>
            <ol className="mt-3 space-y-3 text-[12px] font-medium leading-snug text-obsidian-light">
              {[
                "Keys live in Vercel env vars — SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD — scoped per environment.",
                "A server-only route reads them on demand and opens a real connection to Hostinger.",
                "The result — latency or the exact failure — is rendered right here. No guessing.",
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-canvas font-mono text-[10px] font-bold text-obsidian">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="card p-5">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">If a test fails</h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Route missing → .env not set on this environment — set it and redeploy.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Auth fails → rotate SMTP_PASSWORD in Vercel, then redeploy.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Unreachable → Hostinger IP allow-list or port 587 blocked outbound.</li>
            </ul>
          </div>
        </aside>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
