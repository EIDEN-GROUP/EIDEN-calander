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
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";
import { Modal } from "@/components/settings/Modal";
import { DEMO_CLIENTS, DEMO_CATEGORIES, DEMO_ROOMS } from "@/lib/demo-data";

function exportFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `eiden-calendar-export-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function DataPrivacyView() {
  const { toasts, push } = useToast();
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [anonymizedIds, setAnonymizedIds] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEMO_CLIENTS;
    return DEMO_CLIENTS.filter((c) =>
      [c.full_name, c.company ?? "", c.email ?? "", c.city ?? ""].some((field) => field.toLowerCase().includes(q)),
    );
  }, [query]);

  const selected = DEMO_CLIENTS.find((c) => c.id === selectedId) ?? null;
  const confirmValid = selected !== null && confirmText.trim() === selected.full_name && understood;

  const openAnonymize = () => {
    setQuery("");
    setSelectedId(null);
    setConfirmText("");
    setUnderstood(false);
    setAnonymizeOpen(true);
  };

  const exportWorkspace = () => {
    const now = new Date();
    const payload = {
      export: "eiden-calendar",
      version: 1,
      exportedAt: now.toISOString(),
      generatedBy: "CALENDAR. by Eiden Group — settings/data (demo)",
      workspace: {
        name: "Eiden Group",
        legalName: "Eiden Group SARL",
        timezone: "Africa/Casablanca",
        currency: "MAD",
        locale: "en",
        weekStart: "Monday",
      },
      counts: {
        rooms: DEMO_ROOMS.length,
        categories: DEMO_CATEGORIES.length,
        bookings: 12,
        clients: DEMO_CLIENTS.length,
      },
      settings: {
        workingHours: { monToFri: "09:00-18:30", saturday: "09:30-13:00", sunday: "closed" },
        slotMinutes: 30,
        bufferMinutes: 15,
        minNoticeHours: 2,
      },
      rooms: DEMO_ROOMS.map(({ id, name, location, capacity, hourly_rate, currency, amenities, is_active }) => ({ id, name, location, capacity, hourly_rate, currency, amenities, is_active })),
      categories: DEMO_CATEGORIES.map(({ id, name_en, name_fr, color, icon, type, is_active }) => ({ id, name_en, name_fr, color, icon, type, is_active })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFilename(now);
    anchor.click();
    URL.revokeObjectURL(url);
    push("Export downloaded (demo)");
  };

  const submitAnonymize = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !confirmValid) return;
    setAnonymizedIds((prev) => (prev.includes(selected.id) ? prev : [...prev, selected.id]));
    setBanner(selected.full_name);
    setAnonymizeOpen(false);
    push("Client anonymized (demo)");
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Data & Privacy"
        sub="Export a full workspace snapshot, or anonymize a client on request. Every action here is logged once live."
      />

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* Success banner after anonymization */}
          {banner ? (
            <div role="status" aria-live="polite" className="flex items-start justify-between gap-3 rounded-sm border border-success/40 bg-success-tint px-4 py-3">
              <p className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-tint-fg-green">
                <CircleCheck size={15} strokeWidth={2.4} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span><strong>{banner}</strong> was anonymized (demo). Personal data is replaced with redaction markers — bookings and aggregates are unchanged.</span>
              </p>
              <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss confirmation" className="rounded-pill p-1 text-tint-fg-green transition-colors hover:bg-success/10">
                <X size={15} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {/* Danger zone */}
          <section aria-labelledby="danger-heading" className="card border border-error/50">
            <div className="flex items-center gap-2.5 border-b border-divider px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-error-tint text-error">
                <TriangleExclamationPoint size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <div>
                <h2 id="danger-heading" className="text-[15px] font-extrabold text-obsidian">Danger zone</h2>
                <p className="text-[11px] font-medium text-muted">Irreversible actions. In this build, everything stays in memory — nothing is deleted, nothing is sent.</p>
              </div>
            </div>

            <div className="divide-y divide-divider">
              {/* Export */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="max-w-md">
                  <h3 className="text-[13px] font-bold text-obsidian">Export workspace</h3>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">Full JSON snapshot — settings, rooms, categories and record counts. Never contains credentials.</p>
                </div>
                <button type="button" onClick={exportWorkspace} className="btn btn-secondary h-10 px-4 text-[13px]">
                  <Download size={15} strokeWidth={2.1} aria-hidden="true" />
                  Export workspace (.json)
                </button>
              </div>

              {/* Anonymize */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="max-w-md">
                  <h3 className="text-[13px] font-bold text-obsidian">Anonymize a client</h3>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">GDPR-style erasure on request — name, contacts and notes are replaced with redaction markers. Bookings stay for reporting.</p>
                </div>
                <button
                  type="button"
                  onClick={openAnonymize}
                  className="inline-flex h-10 items-center gap-2 rounded-pill border border-error/50 bg-white px-4 text-[13px] font-semibold text-error transition-colors hover:bg-error-tint"
                >
                  <UserRoundX size={15} strokeWidth={2.1} aria-hidden="true" />
                  Anonymize a client…
                </button>
              </div>

              {/* Retention */}
              <div className="px-5 py-4">
                <h3 className="text-[13px] font-bold text-obsidian">Retention</h3>
                <ul className="mt-2 divide-y divide-divider">
                  {[
                    { icon: Archive, label: "Bookings & invoices", value: "Retained forever" },
                    { icon: ScrollText, label: "Audit log", value: "12 months — purged nightly" },
                    { icon: Bell, label: "Notifications", value: "90 days — then deleted" },
                  ].map(({ icon: Icon, label, value }) => (
                    <li key={label} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-obsidian-light">
                        <Icon size={14} strokeWidth={2} aria-hidden="true" className="text-muted" />
                        {label}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-obsidian">{value}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] font-medium leading-snug text-muted">Retention runs as a nightly job once live — see docs/RUNBOOK.md, backups &amp; restore.</p>
              </div>

              {/* Privacy contact */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-obsidian-light">
                  <Mail size={14} strokeWidth={2} aria-hidden="true" className="text-muted" />
                  Privacy &amp; GDPR requests
                </p>
                <a href="mailto:contact@eiden-group.com" className="font-mono text-[12px] font-semibold text-electric hover:text-electric-hover">
                  contact@eiden-group.com
                </a>
              </div>
            </div>
          </section>

          {/* Client ledger (redacted view) */}
          <section aria-labelledby="ledger-heading" className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
              <h2 id="ledger-heading" className="text-[13px] font-extrabold text-obsidian">Client ledger (demo)</h2>
              <p className="text-[11px] font-medium text-muted">Anonymized rows show redaction markers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                    <th scope="col" className="px-4 py-2.5 sm:px-5">Client</th>
                    <th scope="col" className="px-3 py-2.5">Contact</th>
                    <th scope="col" className="px-3 py-2.5">City</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {DEMO_CLIENTS.map((client) => {
                    const redacted = anonymizedIds.includes(client.id);
                    return (
                      <tr key={client.id} className="transition-colors hover:bg-canvas/60">
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center gap-2.5">
                            <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[10px] font-extrabold ${redacted ? "bg-canvas text-muted" : "bg-tint-blue text-tint-fg-blue"}`}>
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
                            <span className="chip bg-error-tint text-error">Anonymized</span>
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
              Demo build — nothing is deleted. Once live, anonymization is written to the audit log and countersigned by a second admin.
            </p>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
              <FileBraces size={14} strokeWidth={2.2} aria-hidden="true" />
              Before you export
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />The snapshot includes demo entities until Supabase is connected.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />It never contains credentials, tokens or SMTP keys.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Stored client-side in your download folder — we don’t keep a copy.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
              <ShieldCheck size={14} strokeWidth={2.2} aria-hidden="true" />
              What anonymization does
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] font-medium leading-snug text-obsidian-light">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-error" aria-hidden="true" />Replaces name, email, phone, address and notes with redaction markers.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-electric" aria-hidden="true" />Keeps bookings, invoices and aggregates — reporting stays intact.</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-warning" aria-hidden="true" />Irreversible — there is no “un-anonymize”, by design.</li>
            </ul>
          </div>
          <div className="flex items-start gap-2 rounded-sm bg-tint-blue p-3 text-[11px] font-medium leading-snug text-tint-fg-blue">
            <Info size={13} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            A signed erasure request must arrive at contact@eiden-group.com before any real anonymization happens.
          </div>
        </aside>
      </div>

      {/* Anonymize modal */}
      <Modal
        open={anonymizeOpen}
        onClose={() => setAnonymizeOpen(false)}
        title="Anonymize a client"
        description="Type the client's exact name to confirm — this cannot be undone."
        maxWidth="max-w-lg"
        footer={
          <>
            <button type="button" onClick={() => setAnonymizeOpen(false)} className="btn btn-ghost h-10 px-4 text-[13px]">Cancel</button>
            <button
              type="submit"
              form="anonymize-form"
              disabled={!confirmValid}
              className="inline-flex h-10 items-center gap-2 rounded-pill bg-error px-5 text-[13px] font-semibold text-white transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <UserRoundX size={15} strokeWidth={2.1} aria-hidden="true" />
              Anonymize forever
            </button>
          </>
        }
      >
        <form id="anonymize-form" onSubmit={submitAnonymize} className="space-y-4">
          <div className="relative">
            <Search size={14} strokeWidth={2.2} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input h-11 pl-10 text-[13px]"
              placeholder="Search clients by name, company, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search clients"
              autoComplete="off"
            />
          </div>

          <ul role="listbox" aria-label="Clients" className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {filteredClients.length === 0 ? (
              <li className="rounded-sm border border-dashed border-border px-4 py-6 text-center text-[12px] font-medium text-muted">No client matches “{query}”.</li>
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
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-canvas text-[10px] font-extrabold text-obsidian-light">
                        {redacted ? "··" : initials(client.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-bold text-obsidian">{redacted ? "▓▓▓▓▓▓ ▓▓▓▓▓▓" : client.full_name}</span>
                        <span className="block truncate font-mono text-[10px] text-muted">{redacted ? "redacted@redacted.invalid" : client.email ?? "—"}</span>
                      </span>
                      {redacted ? <span className="chip ml-auto shrink-0 bg-error-tint text-error">Anonymized</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {selected ? (
            <div className="space-y-3 border-t border-divider pt-3">
              <div>
                <label htmlFor="confirm-name" className="label">Type “{selected.full_name}” to confirm</label>
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
                I understand this is irreversible and the data cannot be recovered.
              </label>
            </div>
          ) : null}
        </form>
      </Modal>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
