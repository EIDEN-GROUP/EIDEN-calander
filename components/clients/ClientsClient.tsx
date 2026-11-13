/**
 * Clients list — CRM-lite directory.
 * Demo data (DEMO_CLIENTS) + local state.
 * TODO(WIRE): swap for server actions (listClients / createClient) — every
 * mutation site is marked.
 */

"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientAction } from "@/app/actions/clients";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  Mail,
  Phone,
  Plus,
  Rows3,
  Search,
  User,
  X,
} from "lucide-react";
import { NowBarMark } from "@/components/brand/NowBar";
import { DEMO_CLIENTS } from "@/lib/demo-data";
import type { BookingRow, ClientRow, ClientStatus } from "@/lib/types/db";
import type { ClientsListData } from "@/lib/clients-live";
import {
  filterClients,
  formatShortDate,
  latestBookingFor,
  sortClients,
  type ClientSort,
  type ClientStatusFilter,
} from "./model";
import {
  appendStoredClient,
  getClientsSnapshot,
  getServerClientsSnapshot,
  subscribeClients,
} from "./store";
import { EMAIL_RE } from "@/components/formations/model";
import { Avatar } from "@/components/formations/Avatar";
import { Modal } from "@/components/formations/Modal";
import { StatusChip, type ChipTone } from "@/components/formations/StatusChip";
import { ToastViewport, useToast } from "@/components/formations/Toast";

const PAGE_SIZE = 9;

const STATUS_META: Record<ClientStatus, { label: string; tone: ChipTone }> = {
  lead: { label: "Lead", tone: "warning" },
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "muted" },
};

const SOURCES = ["referral", "web", "walk-in", "partner", "event"] as const;

interface NewClientForm {
  type: "person" | "company";
  fullName: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  tags: string;
  notes: string;
}

const EMPTY_FORM: NewClientForm = {
  type: "company",
  fullName: "",
  company: "",
  email: "",
  phone: "",
  source: "web",
  tags: "",
  notes: "",
};

export function ClientsClient({ data }: { data?: ClientsListData | null }) {
  const router = useRouter();
  const live = data?.live === true;
  const liveClients = data?.clients;
  const liveBookings = data?.bookings;
  const { toasts, push, dismiss } = useToast();
  // Locally created clients (sessionStorage) on top of the demo dataset.
  const storedClients = useSyncExternalStore(
    subscribeClients,
    getClientsSnapshot,
    getServerClientsSnapshot,
  );
  const clients = useMemo(() => {
    if (storedClients.length === 0) return DEMO_CLIENTS;
    const storedIds = new Set(storedClients.map((c) => c.id));
    return [...storedClients, ...DEMO_CLIENTS.filter((c) => !storedIds.has(c.id))];
  }, [storedClients]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sort, setSort] = useState<ClientSort>("recent");
  const [page, setPage] = useState(1);

  const allTags = useMemo(
    () => [...new Set(clients.flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b, "en")),
    [clients],
  );

  const filtered = useMemo(
    () => filterClients(clients, query, statusFilter, activeTags),
    [clients, query, statusFilter, activeTags],
  );
  const sorted = useMemo(() => sortClients(filtered, sort, liveBookings), [filtered, sort, liveBookings]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  // All filter/sort setters reset pagination at the call site — no effects.
  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }
  function updateStatusFilter(value: ClientStatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }
  function updateSort(value: ClientSort) {
    setSort(value);
    setPage(1);
  }

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setActiveTags([]);
    setSort("recent");
    setPage(1);
  }

  const hasActiveFilters =
    query.trim() !== "" || statusFilter !== "all" || activeTags.length > 0 || sort !== "recent";

  function cycleNameSort() {
    setSort((current) =>
      current === "name-asc" ? "name-desc" : "name-asc",
    );
    setPage(1);
  }

  /* ---------- new client ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewClientForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  function setType(type: NewClientForm["type"]) {
    setForm((current) => ({ ...current, type, company: type === "person" ? "" : current.company }));
    setFormError(null);
  }

  async function submitNewClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const company = form.company.trim();
    if (!fullName) return setFormError("Full name is required.");
    if (form.type === "company" && !company) return setFormError("Company name is required for a company account.");
    if (!EMAIL_RE.test(email)) return setFormError("Enter a valid email address.");

    const tags = [
      ...new Set(
        form.tags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const client: ClientRow = {
      id: `cli-local-${Date.now()}`,
      type: form.type,
      full_name: fullName,
      company: form.type === "company" ? company : null,
      email,
      phone: form.phone.trim() || null,
      address: null,
      city: null,
      tags,
      status: "lead",
      source: form.source,
      notes: form.notes.trim() || null,
      anonymized_at: null,
      deleted_at: null,
    };
    if (live) {
      const res = await createClientAction({
        type: form.type,
        fullName,
        company: form.type === "company" ? company : null,
        email: email || null,
        phone: form.phone.trim() || null,
        tags,
        source: form.source,
        notes: form.notes.trim() || null,
        status: "lead",
      });
      if (!res.ok) return setFormError(res.error.message);
      if ("duplicate" in res.data) {
        const existing = res.data.duplicate.existing;
        setCreateOpen(false);
        push(`Already exists — ${existing.full_name} (email/phone match)`, "info");
        router.refresh();
        return;
      }
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      push(`Client added — ${fullName}`);
      router.refresh();
      return;
    }
    appendStoredClient(client);
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    push(`Client added — ${fullName}`);
  }

  /* ---------- quick actions ---------- */
  function quickBooking(client: ClientRow) {
    router.push('/calendar?client=' + encodeURIComponent(client.id));
  }
  function quickEnroll(client: ClientRow) {
    router.push('/formations');
  }

  const rangeStart = sorted.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(sorted.length, pageStart + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] text-obsidian sm:text-[32px]">
            Clients
          </h1>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-obsidian-light">
            Your renting customers — rooms, formations &amp; history in one place
          </p>
        </div>
        <button type="button" onClick={() => { setFormError(null); setCreateOpen(true); }} className="btn btn-primary h-11 shadow-electric">
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          New client
        </button>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="client-search" className="sr-only">Search clients by name, company or email</label>
          <input
            id="client-search"
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search name, company, email…"
            className="input h-11 w-full pl-10"
          />
        </div>
        <label htmlFor="client-status" className="sr-only">Filter by status</label>
        <select id="client-status" value={statusFilter} onChange={(e) => updateStatusFilter(e.target.value as ClientStatusFilter)} className="input h-11 w-auto pr-9 text-[13px] font-semibold">
          <option value="all">All statuses</option>
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <label htmlFor="client-sort" className="sr-only">Sort clients</label>
        <select id="client-sort" value={sort} onChange={(e) => updateSort(e.target.value as ClientSort)} className="input h-11 w-auto pr-9 text-[13px] font-semibold">
          <option value="recent">Recent activity</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select>
        <div className="segmented ml-auto max-w-full" role="group" aria-label="Switch between cards and table view">
          <button type="button" className={`segment ${view === "cards" ? "segment-active" : ""}`} aria-pressed={view === "cards"} onClick={() => setView("cards")}>
            <LayoutGrid size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button type="button" className={`segment ${view === "table" ? "segment-active" : ""}`} aria-pressed={view === "table"} onClick={() => setView("table")}>
            <Rows3 size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filter by tag">
          <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">Tags</span>
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`chip border transition-colors ${
                  active
                    ? "border-electric/40 bg-electric-tint text-electric"
                    : "border-transparent bg-track text-obsidian-light hover:bg-hover-fill"
                }`}
              >
                {tag}
              </button>
            );
          })}
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[11px] font-bold text-electric hover:underline">
              <X size={12} strokeWidth={3} aria-hidden="true" />
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {pageItems.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
          <NowBarMark size={52} className="opacity-90" />
          <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.03em] text-obsidian">No clients match</h2>
          <p className="mt-1.5 max-w-md text-[14px] leading-snug text-obsidian-light">
            Loosen the search or filters — or add the account yourself, it takes twenty seconds.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={clearFilters} className="btn btn-secondary h-10 px-5 text-[14px]">
              Clear filters
            </button>
            <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary h-10 px-5 text-[14px]">
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              New client
            </button>
          </div>
        </div>
      ) : view === "cards" ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((client) => (
            <ClientCard key={client.id} client={client} bookings={liveBookings} onQuickBooking={quickBooking} onQuickEnroll={quickEnroll} />
          ))}
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
                <th scope="col" className="px-5 py-3" aria-sort={sort === "name-asc" ? "ascending" : sort === "name-desc" ? "descending" : "none"}>
                  <button type="button" onClick={cycleNameSort} className="inline-flex items-center gap-1.5 hover:text-obsidian">
                    Name
                    <ArrowUpDown size={12} aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Tags</th>
                <th scope="col" className="px-4 py-3" aria-sort={sort === "recent" ? "descending" : "none"}>
                  <button type="button" onClick={() => updateSort("recent")} className="inline-flex items-center gap-1.5 hover:text-obsidian">
                    Last activity
                    <ArrowUpDown size={12} aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((client) => {
                const meta = STATUS_META[client.status];
                const activity = latestBookingFor(client.id, liveBookings);
                const tags = client.tags.slice(0, 2);
                const extra = client.tags.length - tags.length;
                return (
                  <tr key={client.id} className="border-b border-divider align-middle transition-colors last:border-0 hover:bg-canvas">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={client.full_name} kind={client.type} size={32} />
                        <div className="min-w-0">
                          <Link href={`/clients/${client.id}`} className="block truncate font-semibold leading-tight text-obsidian hover:text-electric">
                            {client.full_name}
                          </Link>
                          {client.company && client.company !== client.full_name && (
                            <span className="block truncate text-[11px] font-medium text-muted">{client.company}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-obsidian-light">
                        {client.type === "company" ? <Building2 size={13} aria-hidden="true" /> : <User size={13} aria-hidden="true" />}
                        {client.type === "company" ? "Company" : "Person"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusChip tone={meta.tone} dot>{meta.label}</StatusChip></td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {tags.map((tag) => <span key={tag} className="chip bg-track px-2 py-0.5 text-[10px] font-semibold text-obsidian-light">{tag}</span>)}
                        {extra > 0 && <span className="chip bg-track px-2 py-0.5 text-[10px] font-semibold text-muted">+{extra}</span>}
                        {client.tags.length === 0 && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[12px] font-semibold text-obsidian-light">{formatShortDate(activity.at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => quickBooking(client)} aria-label={`New booking for ${client.full_name}`} title="New booking (demo)" className="flex h-8 w-8 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian">
                          <CalendarPlus size={16} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => quickEnroll(client)} aria-label={`Add ${client.full_name} to a formation`} title="Add to formation (demo)" className="flex h-8 w-8 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian">
                          <GraduationCap size={16} aria-hidden="true" />
                        </button>
                        <Link href={`/clients/${client.id}`} aria-label={`Open ${client.full_name}`} className="flex h-8 w-8 items-center justify-center rounded-pill text-electric transition-colors hover:bg-electric-tint">
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-[12px] font-medium tabular-nums text-muted">
            Showing {rangeStart}–{rangeEnd} of {sorted.length} client{sorted.length === 1 ? "" : "s"}
          </p>
          <nav aria-label="Clients pagination" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={clampedPage === 1}
              aria-label="Previous page"
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-white text-obsidian-light transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                aria-label={`Page ${pageNumber}`}
                aria-current={pageNumber === clampedPage ? "page" : undefined}
                className={`h-9 w-9 rounded-pill text-[13px] font-bold tabular-nums transition-colors ${
                  pageNumber === clampedPage
                    ? "bg-obsidian text-white"
                    : "border border-border bg-white text-obsidian-light hover:bg-canvas"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
              aria-label="Next page"
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-white text-obsidian-light transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </nav>
        </div>
      )}

      {/* New client modal */}
      {createOpen && (
        <Modal
          title="New client"
          description="Accounts start as leads. Bookings and enrollments build the history automatically once wired."
          onClose={() => setCreateOpen(false)}
          size="lg"
        >
          <form onSubmit={submitNewClient} noValidate className="grid gap-4">
            <div>
              <span id="nc-type-label" className="label">Account type</span>
              <div className="segmented" role="group" aria-labelledby="nc-type-label">
                <button type="button" className={`segment ${form.type === "person" ? "segment-active" : ""}`} aria-pressed={form.type === "person"} onClick={() => setType("person")}>
                  <User size={15} aria-hidden="true" />
                  Person
                </button>
                <button type="button" className={`segment ${form.type === "company" ? "segment-active" : ""}`} aria-pressed={form.type === "company"} onClick={() => setType("company")}>
                  <Building2 size={15} aria-hidden="true" />
                  Company
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="nc-name" className="label">{form.type === "company" ? "Contact full name" : "Full name"} *</label>
              <input id="nc-name" type="text" value={form.fullName} onChange={(e) => { setForm({ ...form, fullName: e.target.value }); setFormError(null); }} placeholder={form.type === "company" ? "Yasmine Bouhlal" : "Salma Bennani"} className="input" autoComplete="off" />
            </div>
            {form.type === "company" && (
              <div>
                <label htmlFor="nc-company" className="label">Company *</label>
                <input id="nc-company" type="text" value={form.company} onChange={(e) => { setForm({ ...form, company: e.target.value }); setFormError(null); }} placeholder="Acme SARL" className="input" autoComplete="off" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nc-email" className="label">Email *</label>
                <input id="nc-email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormError(null); }} placeholder="name@company.ma" className="input" autoComplete="off" />
              </div>
              <div>
                <label htmlFor="nc-phone" className="label">Phone</label>
                <input id="nc-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+212 5 22 00 00 00" className="input" autoComplete="off" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nc-source" className="label">Source</label>
                <select id="nc-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="input">
                  {SOURCES.map((source) => (
                    <option key={source} value={source}>{source.charAt(0).toUpperCase() + source.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="nc-tags" className="label">Tags <span className="font-medium normal-case text-muted">(comma-separated)</span></label>
                <input id="nc-tags" type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="recurring, boardroom" className="input" autoComplete="off" />
              </div>
            </div>
            <div>
              <label htmlFor="nc-notes" className="label">Notes</label>
              <textarea id="nc-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Context worth keeping — preferences, billing terms…" className="input h-auto min-h-[64px] py-3 leading-snug" />
            </div>
            {formError && (
              <p role="alert" className="rounded-sm border border-error/30 bg-error-tint px-4 py-2.5 text-[13px] font-semibold text-error">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-divider pt-4">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost h-11 px-5 text-[14px]">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary h-11">
                <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
                Add client
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ---------------- client card (cards view) ---------------- */

function ClientCard({
  client,
  bookings,
  onQuickBooking,
  onQuickEnroll,
}: {
  client: ClientRow;
  bookings?: BookingRow[];
  onQuickBooking: (client: ClientRow) => void;
  onQuickEnroll: (client: ClientRow) => void;
}) {
  const meta = STATUS_META[client.status];
  const secondaryLine =
    client.company && client.company !== client.full_name
      ? client.company
      : (client.city ?? "");
  const tags = client.tags.slice(0, 3);
  const extra = client.tags.length - tags.length;
  const activity = latestBookingFor(client.id, bookings);

  return (
    <article className="card card-hover flex flex-col p-5" aria-label={client.full_name}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={client.full_name} kind={client.type} size={48} />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-obsidian" title={client.full_name}>
              {client.full_name}
            </h2>
            {secondaryLine && (
              <p className="mt-0.5 truncate text-[12px] font-medium text-muted" title={secondaryLine}>
                {secondaryLine}
              </p>
            )}
          </div>
        </div>
        <StatusChip tone={meta.tone} dot className="shrink-0">
          {meta.label}
        </StatusChip>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="chip bg-track px-2 py-0.5 text-[10px] font-semibold text-obsidian-light">
              {tag}
            </span>
          ))}
          {extra > 0 && (
            <span className="chip bg-track px-2 py-0.5 text-[10px] font-semibold text-muted" title={client.tags.slice(3).join(", ")}>
              +{extra}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5 text-[12px] font-medium text-obsidian-light">
        <p className="flex items-center gap-2">
          <Mail size={14} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="truncate" title={client.email ?? undefined}>{client.email ?? "—"}</span>
        </p>
        <p className="flex items-center gap-2">
          <Phone size={14} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="truncate tabular-nums">{client.phone ?? "—"}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-divider pt-4">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
          <CalendarDays size={13} aria-hidden="true" className="shrink-0" />
          <span className="truncate">Latest booking: {formatShortDate(activity.at)}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onQuickBooking(client)}
            aria-label={`New booking for ${client.full_name}`}
            title="New booking (demo)"
            className="flex h-8 w-8 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian"
          >
            <CalendarPlus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onQuickEnroll(client)}
            aria-label={`Add ${client.full_name} to a formation`}
            title="Add to formation (demo)"
            className="flex h-8 w-8 items-center justify-center rounded-pill text-obsidian-light transition-colors hover:bg-hover-fill hover:text-obsidian"
          >
            <GraduationCap size={16} aria-hidden="true" />
          </button>
          <Link
            href={`/clients/${client.id}`}
            className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[12px] font-bold text-electric transition-colors hover:bg-electric-tint"
          >
            View
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
