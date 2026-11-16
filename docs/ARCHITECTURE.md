# CALENDAR. — Architecture

**CALENDAR.** ("Architecture for Time.") is Eiden Group's internal scheduling system — meeting rooms (Casablanca &amp; Agadir) and training formations. Single business, **shared workspace**: all staff see the same rooms/bookings; role split is `admin` vs `staff`. Bilingual EN/FR. Email+password via Supabase Auth — **no OAuth, no public sign-up**.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC, Server Actions) | `cacheComponents: true` in `next.config.ts`; TS strict everywhere |
| UI | React 19, Tailwind CSS **v4** (`@theme` in `app/globals.css`), `lucide-react` | No component library — brand components in `components/brand`, primitives in `components/ui` |
| DB / Auth | **Supabase** (Postgres, Auth, RLS, Storage, Realtime) | Free tier ×2 (staging, prod). RLS **default-deny** |
| Validation | **zod** | Every Server Action input validated; types inferred |
| Forms | react-hook-form + `@hookform/resolvers` | Client-side UX; server re-validates |
| Email (out) | **nodemailer** → Hostinger SMTP (`smtp.hostinger.com`) | Transactional only; no ESP |
| Mail (in) | **imapflow** → `imap.hostinger.com:993` | Inbox: read/search/mark-read/reply only |
| Sanitization | **sanitize-html** | All rendered mail/user HTML |
| i18n | **next-intl** (EN/FR) | Both locales required for every key |
| Charts | **Recharts** | Reports; loaded via `next/dynamic` (client) |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | See docs/AGENTS.md §Testing gates |
| Hosting | **Vercel** | Prod: `calendar.eiden-group.com`; staging: staging project alias |
| Icons/dates | lucide-react, date-fns | |

Not used (deliberately): OAuth/NextAuth (Supabase Auth only), Prisma/Drizzle (hand-written `lib/db/*`), any state-management library (server state is the source of truth; minimal client state via `useState`/URL), Redis/queues (Supabase + Vercel Cron suffice at this scale).

## 2. Rendering strategy

**RSC by default; Server Actions for all mutations; route handlers only where HTTP semantics are required.**

- **Reads** happen in Server Components — direct `lib/db/*` calls, streamed with `<Suspense>` boundaries and `loading.tsx` skeletons. No client-side fetch waterfalls; no `useEffect` data fetching.
- **Mutations** are Server Actions (`"use server"`) in `lib/actions/*.ts` or co-located `actions.ts`. Every action: `requireUser()` → role re-check → zod-validate input → DB via `lib/db/*` → `revalidatePath(...)` → return a discriminated union `{ ok: true, data } | { ok: false, error: string }`. **Never throw raw errors to the client** for expected failures (conflicts, validation).
- **Route handlers** exist **only** for:
  - `POST /api/cron/expire-requests` — Vercel Cron sweep of expiring change requests (requires `Authorization: Bearer ${CRON_SECRET}`).
  - `/api/mail/*` — long-lived IMAP interactions that must not block a Server Action (list/search/refresh, connection test).
  - `/api/export/*` — streaming CSV downloads (`Content-Disposition: attachment`).

Everything else is RSC + Server Actions. If you find yourself adding a route handler for a normal CRUD operation, stop — it belongs in a Server Action.

## 3. Data access

- `lib/db/*.ts` — hand-written, fully typed query modules (`bookings.ts`, `rooms.ts`, `clients.ts`, `formations.ts`, `plans.ts`, `reports.ts`, `requests.ts`, `audit.ts`, `mail.ts`, `notifications.ts`, `settings.ts`, `users.ts`). One module per table aggregate; no ad-hoc Supabase client calls scattered through components.
- **Calendar grid** is served by a single Postgres RPC, `week_grid(p_room_ids uuid[], p_from date, p_to date)` (security-definer, `set search_path = public`), returning rooms × days × active/requested bookings with client names — not N+1 queries.
- **Types**: generated from the live DB — `supabase gen types typescript --linked > lib/supabase/database.types.ts`. CI regenerates and fails on drift (see §10). Hand-written types are limited to DTOs/view models, not table shapes.
- **Migrations** live in `supabase/migrations/<timestamp>_<name>.sql`, applied via `supabase db push` (or the SQL editor for emergencies). **Immutable once applied** — fix forward with a new migration. Seed/demo data in `supabase/seed.sql` (dev only).
- **RLS is the backstop**, not the primary check: server code re-checks auth + role on every mutation (§8). RLS makes a leaked anon key/session non-fatal for admin-only or other-user's rows.
- Realtime (notifications, request status) subscribes to Postgres changes on `notifications`/`change_requests` filtered by `recipient_id = auth.uid()`; RLS applies to realtime too.

## 4. Request flows

### 4.1 Login

```
Browser → GET /login
  └─ RSC renders form (EN/FR by cookie/header)
User submits → Server Action signIn(email, password)
  1. rate-limit check (5 consecutive failures → 15 min lockout; row in login_attempts)
  2. supabase.auth.signInWithPassword(...)
     ├─ fail → increment attempts (lockout at 5) → audit auth.login.failure → { ok:false, error:"Invalid credentials" }
     └─ ok  → reset counter → set session cookies (httpOnly, Secure, SameSite=Lax)
              → profile fetch: must_change_password? → redirect /profile/password
              → audit auth.login.success → redirect /dashboard
Middleware (every request) refreshes the session cookie; expired → redirect /login.
```

### 4.2 Create booking with conflict detection

```
Staff fills booking form (client+room+date+slot) → Server Action createBooking(input)
  1. requireUser() · zod validate · rooms/clients exist & active
  2. BEGIN
     SELECT ... FROM bookings
     WHERE room_id = $1 AND status = 'active'
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2, $3, '[)')
     → overlap found?
       └─ YES → ROLLBACK → compute up to 4 alternative slots
                 (same room, nearest in time; then other rooms, same slot)
                 → return { ok:false, code:"conflict",
                            conflict: { bookingId, title, booker },
                            suggestions: [slot ×≤4] }
                 UI: warning banner (Warning tint) + suggestions +
                     “Request change” CTA
       └─ NO  → INSERT bookings (status 'active') → COMMIT
  3. revalidatePath('/calendar'); revalidatePath('/dashboard')
  4. notify incumbent on conflicts only via change request (see 4.3)
  5. audit booking.create (or booking.conflict_override when forced)
```

There is **no silent double-booking**. A conflict never inserts; it returns a structured warning. The only ways forward: pick a suggested slot, pick another room/time, cancel — or open a **change request** against the incumbent booker.

### 4.3 Change request lifecycle

```
            ┌───────────┐   incumbent approves   ┌───────────┐
 requester  │           │ ─────────────────────▶ │ APPROVED  │ → txn: cancel/move
 ─────────▶ │  PENDING  │                        │           │   original booking, insert new,
            │           │ ─────────────────────▶ └───────────┘   notify both parties
            │           │   incumbent declines   ┌───────────┐
            │           │ ─────────────────────▶ │ DECLINED  │ → booking stays as-is, notify requester
            │           │                        └───────────┘
            │           │ ─── TTL elapses ─────▶ ┌───────────┐
            │           │   (Vercel Cron:        │ EXPIRED   │ → /api/cron/expire-requests (default TTL 72h,
            │           │    CRON_SECRET)        └───────────┘   configurable in settings)
            │           │ ─── requester cancels ▶ ┌───────────┐
            └───────────┘                         │ CANCELLED │
                                                  └───────────┘
Every transition: UPDATE … WHERE status='pending' (optimistic), audit request.*, notify, revalidate.
```

Pending requests surface to the incumbent via notifications + a `/requests` queue; a booking they created can be challenged only through this path.

### 4.4 Inbox (mail) read flow

```
RSC /inbox → Server Component calls lib/mail/list() via imapflow (TLS 993)
             cached ~60s (server-only cache), throttle: ≥15s between manual refreshes
             only MAILBOX_ALLOWED mailbox (constant, not a parameter)
Message click → Server Action getMessage(id) → sanitized HTML (sanitize-html allowlist)
             → rendered in <iframe sandbox="" sandboxed, no scripts, images off by default>
Reply → Server Action reply(id, body) → send via nodemailer as makrich@eiden-group.com,
             In-Reply-To/References set, quoted original sanitized + wrapped in blockquote
             → append to Sent via IMAP (best effort) → audit mail.inbox.reply
No delete, no move, no flag-deletion. Hostinger mailbox is the source of truth.
```

## 5. Module map

| Module | Route | Purpose | Key actions |
|---|---|---|---|
| Dashboard | `/dashboard` | Today: rooms in use, my bookings, pending requests, KPIs | `listDashboard()` |
| Calendar | `/calendar` | Rooms × time grid; day/week/month; conflict UI | `createBooking`, `moveBooking`, `cancelBooking` |
| Formations | `/formations` | Training formations CRUD, cohorts, recurrence | `upsertFormation`, `cancelFormation` |
| Clients | `/clients` | Client directory, history, links to bookings/formations | `upsertClient`, `archiveClient` |
| Plans | `/plans` | Formation pacing/cohort planning across weeks | `upsertPlan`, `assignSlot` |
| Reports | `/reports` | Occupancy, utilization, per-room/per-client activity (Recharts) | `exportCsv` |
| Inbox | `/inbox` | contact@ mailbox — search/read/mark-read/reply | `replyToMessage`, `markRead` |
| Settings | `/settings` | Admin: org settings, mail test, categories, rooms | `updateSettings`, `testMailConnection` |
| Profile | `/profile` | Self-service: name, language, password change (forced on first login) | `changePassword`, `updateProfile` |
| Notifications | `/notifications` | In-app notification feed (Realtime) | `markAllRead` |
| Requests | `/requests` | Change-request queue (incoming approvals, outgoing tracking) | `approveRequest`, `declineRequest`, `cancelRequest` |
| Users (admin) | `/settings/users` | Provision users, temp passwords, reset, unlock, deactivate | `createUser`, `deactivateUser`, `unlockUser` |
| Audit log (admin) | `/settings/audit` | Search/filter audit events, CSV export | `exportAudit` |

Route groups: `app/(staff)/*` for the staff shell, `app/(admin)/*` for admin-gated pages (layout re-checks `role === 'admin'` and redirects otherwise). i18n via next-intl with `messages/en.json` / `messages/fr.json`; locale from cookie, switch in settings/profile; **every key exists in both files**.

## 6. Environments

| | Local | Staging | Production |
|---|---|---|---|
| URL | http://localhost:3000 | Vercel staging project (`*.vercel.app` alias or `staging-calendar…` if a domain is attached) | **https://calendar.eiden-group.com** |
| Branch → deploy | — | PRs / `staging` branch | `main` (after migration push) |
| Supabase project | local CLI or dev free project | staging free project | prod free project |
| `NEXT_PUBLIC_SUPABASE_URL` | dev project | staging project | prod project |
| Email | sandbox: real SMTP but to test mailboxes only | Hostinger, test recipients | Hostinger, real recipients |
| `CRON_SECRET` | any dev string | unique | unique |
| `BUSINESS_PUBLIC_URL` | `http://localhost:3000` or eiden-group.com | eiden-group.com | `https://eiden-group.com` |

**Free-tier pooling note (Supabase):** both staging and prod are **free tier** — ~1 GB DB, **no PITR**, projects **pause after ~7 days of inactivity**. Serverless invocations are short-lived and numerous, so use the **Supavisor pooler (port 6543, transaction mode)** for app traffic; keep the **direct connection (port 5432)** for migrations/`pg_dump` only. If a project is paused, the app 500s — resume it in the Supabase dashboard (see docs/RUNBOOK.md §9).

## 7. Security boundaries

- **RLS default-deny** on every table; `is_admin()` (security-definer, `search_path = public`) gates admin-only rows/actions.
- **Server re-checks**: every Server Action/route handler calls `requireUser()` and, for admin paths, `requireAdmin()` — RLS is a backstop, never the only gate.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) is imported only in `lib/supabase/admin.ts`, guarded by `import 'server-only'`. Never in `NEXT_PUBLIC_*`. Only for user provisioning (create/invite/temp password/unlock/deactivate) — everything else goes through the RLS-scoped per-request client (`lib/supabase/server.ts`).
- Auth cookies: httpOnly, `Secure` (prod), `SameSite=Lax`, refreshed in middleware.
- CSRF: mutations check `Origin`/`Host` (or `sec-fetch-site`) match; SameSite=Lax cookies add a second layer.
- Mail rendering: sandboxed iframe, sanitize-html allowlist, images off by default, attachments type-sniffed + forced download — full matrix in docs/SECURITY.md §2.7.
- Full control inventory, threat model and incident skeleton: **docs/SECURITY.md**.

## 8. Performance

- **RSC + streaming**: data-dependent sections wrapped in `<Suspense>` with skeletons; static shells (frosted header, nav) prerendered.
- **Cache**: reference data (rooms, categories, settings) cached server-side with short TTL/tag; mutations call `revalidatePath`/`revalidateTag`. No client cache library.
- **Bundle budget**: track first-load JS in CI (`@next/bundle-analyzer`); budgets — shared ≤ **180 kB gzip**, any route ≤ **250 kB gzip**; recharts via `next/dynamic` on `/reports` only; tree-shaken lucide imports (`import { X } from 'lucide-react'`).
- **DB**: `week_grid` RPC for calendar; indexes on `bookings(room_id, starts_at, ends_at) WHERE status='active'`, `change_requests(status, expires_at)`, `audit_log(created_at)`; `explain analyze` on the RPCs before merging query changes.
- **Images**: `next/image` only; mail images never proxied.
- **Web Vitals**: LCP < 2.0s on `/dashboard` (fast 3G throttling in Playwright assertions).

## 9. Folder structure (target)

```
eiden-calander/
├─ app/
│  ├─ layout.tsx  page.tsx  globals.css  icon.svg
│  ├─ (staff)/            # staff shell: dashboard, calendar, formations, …
│  │  ├─ layout.tsx       # frosted header + nav, requireUser()
│  │  └─ dashboard|calendar|formations|clients|plans|reports|inbox|requests|notifications|profile/
│  ├─ (admin)/settings/   # admin-gated: users, rooms, categories, audit, mail
│  ├─ (auth)/login/  (auth)/reset-password/
│  └─ api/
│     ├─ cron/expire-requests/route.ts
│     ├─ mail/{list,refresh,test}.ts
│     └─ export/{bookings,clients,audit}.ts
├─ components/
│  ├─ brand/   NowBar.tsx (mark, wordmark, lockup)
│  ├─ ui/      Button, Input, SegmentedControl, EventCard, AvatarGroup, Chip, FrostedBar…
│  └─ <module>/ feature components (client components, only where interactive)
├─ lib/
│  ├─ supabase/{client,server,admin}.ts  database.types.ts
│  ├─ db/       bookings.ts rooms.ts clients.ts formations.ts plans.ts requests.ts audit.ts …
│  ├─ mail/     imap.ts smtp.ts sanitize.ts   # server-only
│  ├─ email/    templates/*.tsx               # react-email-style templates
│  ├─ actions/  *.ts                          # "use server" mutations
│  └─ utils/    cn(), dates, money…
├─ messages/{en.json,fr.json}
├─ supabase/
│  ├─ migrations/  seed.sql  config.toml
│  └─ tests/       (pgTAP or SQL smoke tests for RLS/RPCs)
├─ scripts/create-admin.mjs
├─ tests/{unit/ (vitest), e2e/ (playwright)}
├─ docs/           (this folder)
└─ public/
```

> **Current state:** the repo is the v0 scaffold (brand tokens, mark, login artwork landed; feature modules land per docs/AGENTS.md roles). This tree is the contract agents build toward; keep this file in sync when the structure changes.

## 10. CI pipeline (GitHub Actions)

`push`/PR → **lint** (`eslint`) → **typecheck** (`tsc --noEmit`) → **unit** (vitest) → **types-drift check** (`supabase gen types` + `git diff --exit-code`) → **build** (`next build`) → **audit gate** (`npm audit --omit=dev --audit-level=high`) → preview deploy (PR) → staging smoke (Playwright, `@playwright/test`) → on `main`: deploy prod **after** migrations applied. See docs/RUNBOOK.md §3 and docs/AGENTS.md §Testing gates.

## 11. ADR register

Architecture decisions (and why) live in `docs/adr/NNNN-title.md` as they are made — e.g. 0001: RLS-default-deny + server re-checks; 0002: no OAuth, email+password only; 0003: change-request workflow instead of silent double-booking; 0004: route handlers only for cron/mail/export; 0005: free-tier Supabase with weekly `pg_dump`. Add an ADR with every decision that future contributors would otherwise re-litigate.
