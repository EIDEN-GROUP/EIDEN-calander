"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  Bell,
  CircleCheck,
  Download,
  FileBraces,
  Info,
  Mail,
  ScrollText,
  Search,
  ShieldCheck,
  TriangleExclamationPoint,
  UserRoundX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { anonymizeClientAction } from "@/app/actions/clients";
import { exportWorkspaceAction } from "@/app/actions/export";

export interface LedgerClient {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  city: string | null;
  status: string;
  anonymized_at: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function DataPrivacyView({
  initialClients,
  live = false,
}: {
  initialClients: LedgerClient[];
  live?: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const { toasts, leaving, push } = useToast();
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [anonymizedIds, setAnonymizedIds] = useState<string[]>(
    () => initialClients.filter((c) => c.anonymized_at !== null).map((c) => c.id),
  );
  const [banner, setBanner] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialClients;
    return initialClients.filter((c) =>
      [c.full_name, c.company ?? "", c.email ?? "", c.city ?? ""].some((field) => field.toLowerCase().includes(q)),
    );
  }, [initialClients, query]);

  const selected = initialClients.find((c) => c.id === selectedId) ?? null;
  const confirmValid = selected !== null && confirmText.trim() === selected.full_name && understood;

  const openAnonymize = () => {
    setQuery("");
    setSelectedId(null);
    setConfirmText("");
    setUnderstood(false);
    setAnonymizeOpen(true);
  };

  const exportWorkspace = async () => {
    if (!live) {
      push(t("exportDisabledNote"));
      return;
    }
    setExporting(true);
    try {
      const res = await exportWorkspaceAction();
      if (!res.ok) {
        push(res.error.message);
        return;
      }
      const blob = new Blob([res.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = res.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      push(t("snapshotDownloaded", { size: (res.data.byteLength / 1024).toFixed(0) }));
    } finally {
      setExporting(false);
    }
  };

  const submitAnonymize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !confirmValid) return;
    if (!live) {
      push(t("anonymizeDisabledNote"));
      return;
    }
    const res = await anonymizeClientAction({ clientId: selected.id, confirmName: confirmText.trim() });
    if (!res.ok) {
      push(res.error.message);
      return;
    }
    setAnonymizedIds((prev) => (prev.includes(selected.id) ? prev : [...prev, selected.id]));
    setBanner(selected.full_name);
    setAnonymizeOpen(false);
    push(t("clientAnonymizedToast"));
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("tabData")}
        sub={t("dataPrivacySub")}
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Success banner after anonymization */}
          {banner ? (
            <div role="status" aria-live="polite" className="flex items-start justify-between gap-3 rounded-sm border border-success/40 bg-success-tint px-4 py-3">
              <p className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-tint-fg-green">
                <CircleCheck size={15} strokeWidth={2.4} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span><strong>{banner}</strong> {t("anonymizedBannerBody")}</span>
              </p>
              <button type="button" onClick={() => setBanner(null)} aria-label={t("dismissConfirmationAria")} className="rounded-pill p-1 text-tint-fg-green transition-colors hover:bg-success/10">
                <X size={15} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {/* Danger zone */}
          <section aria-labelledby="danger-heading" className="card border border-error/50">
            <div className="flex items-center gap-2.5 border-b border-divider px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-error-tint text-error-fg">
                <TriangleExclamationPoint size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <div>
                <h2 id="danger-heading" className="text-[15px] font-extrabold text-obsidian">{t("dangerZone")}</h2>
                <p className="text-[11px] font-medium text-muted">{t("dangerZoneDesc")}</p>
              </div>
            </div>

            <div className="divide-y divide-divider">
              {/* Export */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="max-w-md">
                  <h3 className="text-[13px] font-bold text-obsidian">{t("exportWorkspaceTitle")}</h3>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">{t("exportWorkspaceDesc")}</p>
                </div>
                <button type="button" onClick={() => void exportWorkspace()} disabled={exporting} className="btn btn-secondary h-10 px-4 text-[13px] disabled:opacity-60">
                  <Download size={15} strokeWidth={2.1} aria-hidden="true" />
                  {exporting ? t("snapshotting") : t("exportWorkspaceButton")}
                </button>
              </div>

              {/* Anonymize */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="max-w-md">
                  <h3 className="text-[13px] font-bold text-obsidian">{t("anonymizeClientTitle")}</h3>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">{t("anonymizeClientDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={openAnonymize}
                  className="inline-flex h-10 items-center gap-2 rounded-pill border border-error/50 bg-white px-4 text-[13px] font-semibold text-error-fg transition-colors hover:bg-error-tint"
                >
                  <UserRoundX size={15} strokeWidth={2.1} aria-hidden="true" />
                  {t("anonymizeClientButton")}
                </button>
              </div>

              {/* Retention */}
              <div className="px-5 py-4">
                <h3 className="text-[13px] font-bold text-obsidian">{t("retentionHeading")}</h3>
                <ul className="mt-2 divide-y divide-divider">
                  {[
                    { icon: Archive, labelKey: "retentionBookings", valueKey: "retentionBookingsValue" },
                    { icon: ScrollText, labelKey: "retentionAudit", valueKey: "retentionAuditValue" },
                    { icon: Bell, labelKey: "retentionNotifications", valueKey: "retentionNotificationsValue" },
                  ].map(({ icon: Icon, labelKey, valueKey }) => (
                    <li key={labelKey} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-obsidian-light">
                        <Icon size={14} strokeWidth={2} aria-hidden="true" className="text-muted" />
                        {t(labelKey)}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-obsidian">{t(valueKey)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] font-medium leading-snug text-muted">{t("retentionNote")}</p>
              </div>

              {/* Privacy contact */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-obsidian-light">
                  <Mail size={14} strokeWidth={2} aria-hidden="true" className="text-muted" />
                  {t("privacyContact")}
                </p>
                <a href="mailto:makrich@eiden-group.com" className="font-mono text-[12px] font-semibold text-electric hover:text-electric-hover">
                  makrich@eiden-group.com
                </a>
              </div>
            </div>
          </section>

          {/* Client ledger (redacted view) */}
          <section aria-labelledby="ledger-heading" className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
              <h2 id="ledger-heading" className="text-[13px] font-extrabold text-obsidian">{t("clientLedgerHeading")}</h2>
              <p className="text-[11px] font-medium text-muted">{t("ledgerNote")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    <th scope="col" className="px-4 py-2.5 sm:px-5">{t("colClient")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colContact")}</th>
                    <th scope="col" className="px-3 py-2.5">{t("colCity")}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {initialClients.map((client) => {
                    const redacted = anonymizedIds.includes(client.id);
                    return (
                      <tr key={client.id} className="transition-colors hover:bg-canvas/60">
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center gap-2.5">
                            <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[11px] font-extrabold ${redacted ? "bg-canvas text-muted" : "bg-tint-blue text-tint-fg-blue"}`}>
                              {redacted ? "··" : initials(client.full_name)}
                            </span>
                            <span className={redacted ? "font-mono font-semibold text-muted" : "font-semibold text-obsidian"}>
                              {redacted ? "▓▓▓▓▓▓ ▓▓▓▓▓▓" : client.full_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-obsidian-light">
                          {redacted ? "redacted@redacted.invalid" : client.email ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-medium text-obsidian-light">{redacted ? "•••" : client.city ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {redacted ? (
                            <span className="chip bg-error-tint text-error-fg">{t("anonymizedChip")}</span>
                          ) : (
                            <span className="chip bg-canvas text-muted">{client.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-divider px-4 py-3 text-[11px] font-medium leading-snug text-muted sm:px-5">
              {t("ledgerFooterNote")}
            </p>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">
              <FileBraces size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("beforeYouExportHeading")}
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("beforeExportSnapshot")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("beforeExportCredentials")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("beforeExportClientSide")}</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">
              <ShieldCheck size={14} strokeWidth={2.2} aria-hidden="true" />
              {t("whatAnonymizationDoesHeading")}
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-error" aria-hidden="true" />{t("anonymizeReplaces")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />{t("anonymizeKeeps")}</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-warning" aria-hidden="true" />{t("anonymizeIrreversible")}</li>
            </ul>
          </div>
          <div className="flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[11px] font-medium leading-snug text-tint-fg-blue">
            <Info size={13} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t("erasureRequestNote")}
          </div>
        </aside>
      </div>

      {/* Anonymize modal */}
      <Modal
        open={anonymizeOpen}
        onClose={() => setAnonymizeOpen(false)}
        title={t("anonymizeClientTitle")}
        description={t("anonymizeConfirmDesc")}
        maxWidth="max-w-lg"
        footer={
          <>
            <button type="button" onClick={() => setAnonymizeOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">{t("cancel")}</button>
            <button
              type="submit"
              form="anonymize-form"
              disabled={!confirmValid}
              className="inline-flex h-10 items-center gap-2 rounded-pill bg-error px-5 text-[13px] font-semibold text-white transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <UserRoundX size={15} strokeWidth={2.1} aria-hidden="true" />
              {t("anonymizeForeverButton")}
            </button>
          </>
        }
      >
        <form id="anonymize-form" onSubmit={submitAnonymize} className="space-y-4">
          <div className="relative">
            <Search size={14} strokeWidth={2.2} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input h-11 pl-10 text-[13px]"
              placeholder={t("searchClientsPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t("searchClientsAria")}
              autoComplete="off"
            />
          </div>

          <ul role="listbox" aria-label={t("clientsListboxAria")} className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {filteredClients.length === 0 ? (
              <li className="rounded-sm border border-dashed border-border px-4 py-6 text-center text-[12px] font-medium text-muted">{t("noClientMatches", { query })}</li>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedId === client.id;
                const redacted = anonymizedIds.includes(client.id);
                return (
                  <li key={client.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={redacted}
                      onClick={() => { setSelectedId(client.id); setConfirmText(""); setUnderstood(false); }}
                      className={`flex w-full items-center gap-2.5 rounded-sm border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected ? "border-error/50 bg-error-tint ring-1 ring-error/40" : "border-border bg-white hover:bg-canvas"
                      }`}
                    >
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-canvas text-[11px] font-extrabold text-obsidian-light">
                        {redacted ? "··" : initials(client.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span title={redacted ? undefined : client.full_name} className="block truncate text-[12px] font-bold text-obsidian">{redacted ? "▓▓▓▓▓▓ ▓▓▓▓▓▓" : client.full_name}</span>
                        <span className="block truncate font-mono text-[11px] text-muted" title={redacted ? undefined : client.email ?? undefined}>{redacted ? "redacted@redacted.invalid" : client.email ?? "—"}</span>
                      </span>
                      {redacted ? <span className="chip ml-auto shrink-0 bg-error-tint text-error-fg">{t("anonymizedChip")}</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {selected ? (
            <div className="space-y-3 border-t border-divider pt-3">
              <div>
                <label htmlFor="confirm-name" className="label">{t("typeToConfirm", { name: selected.full_name })}</label>
                <input
                  id="confirm-name"
                  className="input h-11 font-mono text-[13px]"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={selected.full_name}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-error/30 bg-error-tint/60 p-3 text-[12px] font-semibold leading-snug text-obsidian">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-error)]"
                />
                {t("irreversibleUnderstood")}
              </label>
            </div>
          ) : null}
        </form>
      </Modal>

      <ToastViewport toasts={toasts} leaving={leaving} />
    </div>
  );
}
