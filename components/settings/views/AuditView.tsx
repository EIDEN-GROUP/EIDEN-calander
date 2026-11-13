"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleExclamationPoint,
  Download,
  ScrollText,
  Search,
  ServerCog,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/settings/PageHeader";
import { ToastViewport, useToast } from "@/components/settings/Toast";

type Verb = "create" | "update" | "delete" | "auth" | "settings";

interface AuditEntry {
  id: number;
  at: Date;
  actor: string;
  verb: Verb;
  entity: string;
  details: string;
  meta: {
    requestId: string;
    ip: string;
    userAgent: string;
    entityId: string;
  };
}

const VERB_META: Record<Verb, { label: string; chip: string }> = {
  create: { label: "Create", chip: "bg-success-tint text-tint-fg-green" },
  update: { label: "Update", chip: "bg-tint-blue text-tint-fg-blue" },
  delete: { label: "Delete", chip: "bg-error-tint text-error" },
  auth: { label: "Auth", chip: "bg-warning-tint text-tint-fg-amber" },
  settings: { label: "Settings", chip: "bg-canvas text-muted" },
};

const TEMPLATES: Array<{ verb: Verb; entity: string; details: string[] }> = [
  { verb: "create", entity: "booking", details: ["bk-1042 confirmed — Salle Grande · Acme SARL · Tue 14:00", "bk-1043 created — React Avancé S3 · Salle Formation", "bk-1044 created — ONCF · Salle Grande · pending_conflict"] },
  { verb: "update", entity: "booking", details: ["bk-1021 moved 09:30 → 10:00 — buffer revalidated", "bk-1033 notes updated · 'They bring own coffee'", "bk-1019 price 675 → 900 MAD"] },
  { verb: "delete", entity: "booking", details: ["bk-0990 cancelled — Salle Petite · client notified", "bk-0977 cancelled by client — refund 500 MAD"] },
  { verb: "create", entity: "client", details: ["cli-9 created — ONCF · source web", "cli-10 created — Salma Bennani · source walk-in"] },
  { verb: "update", entity: "client", details: ["cli-1 tags updated — +recurring", "cli-6 status active → inactive"] },
  { verb: "delete", entity: "client", details: ["cli-legacy-3 merged into cli-1 (dedupe)"] },
  { verb: "auth", entity: "session", details: ["auth.login.success — 102.130.44.18", "auth.login.failure — wrong password ×2", "auth.password.changed — 3 sessions revoked"] },
  { verb: "auth", entity: "user", details: ["usr-karim MFA enrolled — TOTP", "usr-sofia deactivated — sessions revoked"] },
  { verb: "settings", entity: "settings", details: ["settings.general saved — currency MAD", "settings.notifications saved — digest on", "settings.working_hours saved — Sat 09:30–13:00", "settings.categories reordered — Maintenance up"] },
  { verb: "settings", entity: "room", details: ["room-grande rate 400 → 450 MAD", "room-petite deactivated — hidden from pickers"] },
  { verb: "create", entity: "user", details: ["usr-sofia role staff → admin — reverted same day", "usr-karim invited — temp password issued"] },
  { verb: "update", entity: "formation", details: ["bk-11 capacity reached — waitlist auto-activated", "bk-5 price_label 900 MAD set"] },
  { verb: "create", entity: "change_request", details: ["cr-1 opened — ONCF × React S3 conflict", "cr-2 approved — React S3 moved to 15:00"] },
  { verb: "update", entity: "change_request", details: ["cr-2 expires in 6h — nudge sent", "cr-1 declined — requester notified"] },
];

const ACTORS = ["Marouane A.", "Yasmine B.", "Yasmine B.", "Karim L.", "Karim L.", "Marouane A.", "System", "System"];
const USER_AGENTS = ["Chrome 131 · macOS", "Safari 18 · iPhone", "Chrome 131 · Android", "Firefox 133 · Windows", "Internal scheduler"];

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed reference instant — keeps prerender and hydration identical. */
const DEMO_EPOCH = new Date(2026, 10, 13, 8, 15, 0).getTime();

/** Deterministic demo log — 44 entries, newest first, spanning roughly two weeks. */
function buildEntries(): AuditEntry[] {
  const rand = mulberry32(20261113);
  const entries: AuditEntry[] = [];
  let cursor = DEMO_EPOCH;
  for (let i = 0; i < 44; i++) {
    const template = TEMPLATES[Math.floor(rand() * TEMPLATES.length)];
    const details = template.details[Math.floor(rand() * template.details.length)];
    const actor = ACTORS[Math.floor(rand() * ACTORS.length)];
    entries.push({
      id: i + 1,
      at: new Date(cursor),
      actor,
      verb: template.verb,
      entity: template.entity,
      details,
      meta: {
        requestId: `req_${Math.floor(rand() * 0xffffffff).toString(36).padStart(7, "0")}`,
        ip: `102.130.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
        userAgent: USER_AGENTS[Math.floor(rand() * USER_AGENTS.length)],
        entityId: `${template.entity.slice(0, 3)}-${Math.floor(rand() * 9000) + 1000}`,
      },
    });
    cursor -= (1 + rand() * 11) * 60 * 60 * 1000;
  }
  return entries;
}

const source = buildEntries();
const ACTOR_OPTIONS = Array.from(new Set(source.map((e) => e.actor))).sort();
const PAGE_SIZE = 12;

export interface AuditEntryLive {
  id: number;
  at: Date;
  actor: string;
  verb: Verb;
  entity: string;
  details: string;
  meta: { requestId: string; ip: string; userAgent: string; entityId: string };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function AuditView({
  entries: entriesProp,
  live,
}: {
  entries?: AuditEntryLive[];
  live?: boolean;
}) {
  const source: AuditEntry[] = entriesProp ?? ALL_ENTRIES;
  const actorOptions = live ? Array.from(new Set(source.map((e) => e.actor))).sort() : ACTOR_OPTIONS;
  const { toasts, push } = useToast();
  const [actor, setActor] = useState<string>("all");
  const [verb, setVerb] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59`) : null;
    return source.filter((entry) => {
      if (actor !== "all" && entry.actor !== actor) return false;
      if (verb !== "all" && entry.verb !== verb) return false;
      if (fromDate && entry.at < fromDate) return false;
      if (toDate && entry.at > toDate) return false;
      if (q) {
        const haystack = `${entry.actor} ${entry.verb} ${entry.entity} ${entry.details}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [actor, verb, from, to, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const effectivePage = Math.min(Math.max(1, page), totalPages);

  const resetAndSet = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const paged = filtered.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);
  const hasFilters = actor !== "all" || verb !== "all" || from !== "" || to !== "" || query.trim() !== "";

  const clearFilters = () => {
    setActor("all");
    setVerb("all");
    setFrom("");
    setTo("");
    setQuery("");
    setPage(1);
  };

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const header = ["When", "Actor", "Action", "Entity", "Details"].map(csvCell).join(",");
    const rows = filtered.map((entry) =>
      [entry.at.toISOString(), entry.actor, VERB_META[entry.verb].label, entry.entity, entry.details].map(csvCell).join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    anchor.href = url;
    anchor.download = `eiden-calendar-audit-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    push(`Exported ${filtered.length} row${filtered.length === 1 ? "" : "s"} (demo)`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit Log"
        sub="Every write, who made it, and when — searchable, filterable, exportable. Admin-only by policy."
      >
        <span className="chip bg-obsidian text-[10px] uppercase tracking-[0.12em] text-white">Admin</span>
      </PageHeader>

      {/* Filters */}
      <div className="card mt-5 flex flex-wrap items-end gap-2 p-3 sm:p-4">
        <div>
          <label htmlFor="audit-actor" className="label">Actor</label>
          <select id="audit-actor" className="input h-10 w-36 px-2.5 text-[13px]" value={actor} onChange={(e) => resetAndSet(setActor)(e.target.value)}>
            <option value="all">All actors</option>
            {ACTOR_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-verb" className="label">Action</label>
          <select id="audit-verb" className="input h-10 w-32 px-2.5 text-[13px]" value={verb} onChange={(e) => resetAndSet(setVerb)(e.target.value)}>
            <option value="all">All actions</option>
            {Object.entries(VERB_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="label">From</label>
          <input id="audit-from" type="date" className="input h-10 w-36 px-2.5 text-[13px]" value={from} onChange={(e) => resetAndSet(setFrom)(e.target.value)} />
        </div>
        <div>
          <label htmlFor="audit-to" className="label">To</label>
          <input id="audit-to" type="date" className="input h-10 w-36 px-2.5 text-[13px]" value={to} onChange={(e) => resetAndSet(setTo)(e.target.value)} />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="audit-search" className="label">Search</label>
          <div className="relative">
            <Search size={14} strokeWidth={2.2} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="audit-search"
              className="input h-10 pl-9 text-[13px]"
              placeholder="booking, actor, entity…"
              value={query}
              onChange={(e) => resetAndSet(setQuery)(e.target.value)}
              autoComplete="off"
            />
            {query ? (
              <button type="button" onClick={() => resetAndSet(setQuery)("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-pill p-1 text-muted hover:text-obsidian">
                <X size={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={exportCsv} className="btn btn-secondary h-10 px-4 text-[13px]">
          <Download size={15} strokeWidth={2.1} aria-hidden="true" />
          Export CSV
        </button>
        {hasFilters ? (
          <button type="button" onClick={clearFilters} className="btn btn-ghost h-10 px-3 text-[12px]">
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3 sm:px-5">
          <p className="text-[12px] font-semibold text-obsidian-light">
            <span className="font-mono text-obsidian">{filtered.length}</span> of {source.length} entries
          </p>
          <p className="text-[11px] font-medium text-muted">Click a row for request metadata</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                <th scope="col" className="px-4 py-2.5 sm:px-5">When</th>
                <th scope="col" className="px-3 py-2.5">Actor</th>
                <th scope="col" className="px-3 py-2.5">Action</th>
                <th scope="col" className="px-3 py-2.5">Entity</th>
                <th scope="col" className="px-3 py-2.5">Details</th>
                <th scope="col" className="w-12 px-2 py-2.5"><span className="sr-only">Expand</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <CircleExclamationPoint size={26} strokeWidth={1.8} aria-hidden="true" className="mx-auto text-muted" />
                    <p className="mt-3 text-[14px] font-bold text-obsidian">No entries match</p>
                    <p className="mt-1 text-[12px] font-medium text-muted">Try wider dates, another actor, or clear the search.</p>
                    <button type="button" onClick={clearFilters} className="btn btn-secondary mt-4 h-9 px-4 text-[12px]">Clear filters</button>
                  </td>
                </tr>
              ) : (
                paged.map((entry) => {
                  const isOpen = expanded.has(entry.id);
                  const metaId = `meta-${entry.id}`;
                  return [
                    <tr
                      key={entry.id}
                      onClick={() => toggleExpanded(entry.id)}
                      className="cursor-pointer align-middle transition-colors hover:bg-canvas/60"
                    >
                      <td className="px-4 py-2.5 sm:px-5">
                        <span className="block text-[12px] font-bold leading-tight text-obsidian">{dateFmt.format(entry.at)}</span>
                        <span className="font-mono text-[10px] leading-tight text-muted">{timeFmt.format(entry.at)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-obsidian-light">
                          {entry.actor === "System" ? (
                            <ServerCog size={13} strokeWidth={2.2} aria-hidden="true" className="text-muted" />
                          ) : (
                            <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-pill bg-tint-blue text-[8px] font-extrabold text-tint-fg-blue">
                              {entry.actor.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                          )}
                          {entry.actor}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`chip ${VERB_META[entry.verb].chip}`}>{VERB_META[entry.verb].label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <code className="font-mono text-[11px] font-semibold text-obsidian-light">{entry.entity}</code>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 font-mono text-[11px] text-muted" title={entry.details}>
                        {entry.details}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(entry.id);
                          }}
                          aria-expanded={isOpen}
                          aria-controls={metaId}
                          aria-label={`${isOpen ? "Hide" : "Show"} request metadata for entry ${entry.id}`}
                          className="rounded-pill p-1.5 text-muted transition-all hover:bg-canvas hover:text-obsidian"
                        >
                          <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${entry.id}-meta`}>
                        <td colSpan={6} id={metaId} className="bg-canvas/40 px-4 pb-3 pt-0 sm:px-5">
                          <pre className="overflow-x-auto rounded-sm bg-obsidian p-3 font-mono text-[11px] leading-relaxed text-white/80">
                            {JSON.stringify(
                              {
                                at: entry.at.toISOString(),
                                actor: entry.actor,
                                action: `${entry.verb}.${entry.entity}`,
                                ...entry.meta,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3 sm:px-5">
          <p className="text-[11px] font-medium text-muted" aria-live="polite">
            Showing <span className="font-mono text-obsidian">{paged.length === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1}–{(effectivePage - 1) * PAGE_SIZE + paged.length}</span> of <span className="font-mono text-obsidian">{filtered.length}</span> · page {effectivePage} of {totalPages}
          </p>
          <nav aria-label="Audit log pages" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={effectivePage === 1}
              aria-label="Previous page"
              className="rounded-pill border border-border bg-white p-2 text-obsidian-light transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={effectivePage === totalPages}
              aria-label="Next page"
              className="rounded-pill border border-border bg-white p-2 text-obsidian-light transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </nav>
        </div>

        <p className="flex flex-wrap items-center gap-2 border-t border-divider px-4 py-3 text-[11px] font-medium leading-snug text-muted sm:px-5">
          <ScrollText size={12} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
          Retained 12 months, then purged nightly — change retention on{" "}
          <Link href="/settings/data" className="font-semibold text-electric hover:text-electric-hover">Data &amp; Privacy</Link>.
          Exports include only the filtered view.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-muted">
        <CircleCheck size={13} strokeWidth={2.2} aria-hidden="true" className="text-tint-fg-green" />
        Every mutation in this workspace is recorded here — exports and anonymizations included once live.
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
