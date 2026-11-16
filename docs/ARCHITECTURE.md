# CALENDAR. · Architecture

**CALENDAR.** ("Architecture for Time.") is Eiden Group's internal scheduling system: meeting rooms (Casablanca &amp; Agadir) and training formations. Single business, **shared workspace**: all staff see the same rooms/bookings; role split is `admin` vs `staff`. Bilingual EN/FR. Email+password via Supabase Auth: **no OAuth, no public sign-up**.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC, Server Actions) | `cacheComponents: true` in `next.config.ts`; TS strict everywhere |
| UI | React 19, Tailwind CSS **v4** (`@theme` in `app/globals.css`), `lucide-react` | No component library: brand marks in `components/brand`, module-local components elsewhere |
| DB / Auth | **Supabase** (Postgres, Auth, RLS, Storage, Realtime) | Free tier ×2 (staging, prod). RLS **default-deny** |
| Validation | **zod** | Every Server Action input validated; types inferred |
| Forms | react-hook-form + `@hookform/resolvers` | Client-side UX; server re-validates |
| Email (out) | **nodemailer** → Hostinger SMTP (`smtp.hostinger.com`) | Transactional only; no ESP |
| Mail (in) | **imapflow** → `imap.hostinger.com:993` | Inbox: read/search/mark-read/reply only |
| Sanitization | **sanitize-html** | All rendered mail/user HTML |
| i18n | **next-intl** (EN/FR) | Both locales required for every key |
| Charts | **Recharts** | Reports; client component rendered inside an RSC + Suspense page |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | See docs/AGENTS.md §Testing gates |
| Hosting | **Vercel** | Prod: `calendar.eiden-group.com`; staging: staging project alias |
| Icons/dates | lucide-react, date-fns | |

Not used (deliberately): OAuth/NextAuth (Supabase Auth only), Prisma/Drizzle (hand-written typed loaders in `lib/`), any state-management library (server state is the source of truth; minimal client state via `useState`/URL), Redis/queues (Supabase + Vercel Cron suffice at this scale).

## 2. Rendering strategy

**RSC by default; Server Actions for all mutations; route handlers only where HTTP semantics are required.**

- **Reads** happen in Server Components: direct calls to the typed loaders in `lib/` (e.g. `lib/live-data.ts`), streamed with `<Suspense>` boundaries and `loading.tsx` skeletons. No client-side fetch waterfalls; no `useEffect` data fetching.
- **Mutations** are Server Actions (`"use server"`) in `app/actions/*.ts`. Every action: `requireUser()` → role re-check → zod-validate input → DB via typed loaders → `revalidatePath(...)` → return a discriminated union `{ ok: true, data } | { ok: false, error: string }`. **Never throw raw errors to the client** for expected failures (conflicts, validation).
- **Route handlers** exist **only** for:
  - `POST /api/cron/expire-requests`: Vercel Cron sweep of expiring change requests (requires `Authorization: Bearer ${CRON_SECRET}`).
  - `/api/mail/*`: long-lived IMAP interactions that must not block a Server Action (`messages` list, `message` read, `reply`, `attachment` download forced to attachment, `test`/`test-send` connection checks).
  - There is no `/api/export/*`: CSV downloads are built client-side from the on-screen, currently-filtered dataset (`components/charts/csv.ts`, audit log export likewise).

Everything else is RSC + Server Actions. If you find yourself adding a route handler for a normal CRUD operation, stop. It belongs in a Server Action.

## 3. Data access

- Live-data reads are hand-written, fully typed loaders: `lib/live-data.ts` (calendar), `lib/dashboard-live.ts`, `lib/reports-live.ts`, `lib/clients-live.ts`, `lib/plans-live.ts`, plus `lib/slots.ts` / `lib/conflict.ts` (booking-slot math) and `lib/notifications.ts` / `lib/audit.ts`. Falling back to the bundled demo dataset (`lib/demo-data.ts`) when Supabase is unconfigured or unreachable. Settings pages query the per-request RLS client directly. No ad-hoc Supabase client calls in components.
- **Calendar data** loads server-side via `lib/live-data.ts` (rooms, categories, clients, ≤2000 bookings, working hours) and reaches the client as props; the client renders the grid. No dedicated grid RPC exists (it was planned, never built).
- **Types**: generated from the live DB: `supabase gen types typescript --linked > lib/supabase/database.types.ts`. The drift check is not automated; regenerate in the same PR as a schema change (see §10). Hand-written types are limited to DTOs/view models, not table shapes.
- **Migrations** live in `supabase/migrations/<timestamp>_<name>.sql`, applied via `supabase db push` (or the SQL editor for emergencies). **Immutable once applied**: fix forward with a new migration. Seed/demo data in `supabase/seed.sql` (dev only).
- **RLS is the backstop**, not the primary check: server code re-checks auth + role on every mutation (§8). RLS makes a leaked anon key/session non-fatal for admin-only or other-user's rows.
- Realtime is not wired today: notifications are written via the `notify_user()` RPC and counted at page load (bell). If Realtime is added, it would subscribe to Postgres changes on `notifications`/`change_requests` filtered by `recipient_id = auth.uid()`; RLS applies to realtime too.

## 4. Request flows

### 4.1 Login

```
Browser → GET /login
  └─ RSC renders form (EN/FR by cookie/header)
User submits → Server Action login(prevState, formData)
  1. no app-level rate limit (brute-force throttling is whatever the Supabase project is configured for)
  2. supabase.auth.signInWithPassword(...)
     ├─ fail → { ok:false, errorKey:"invalid" } (generic message; nothing audited today)
     └─ ok  → set session cookies (httpOnly, Secure, SameSite=Lax)
               → must_change_password enforced by the proxy on the next request (/profile?first-login=1)
               → redirect /dashboard (no auth.login.success audit is written today)
Middleware (every request) refreshes the session cookie; unauthenticated app routes bounce to /login.
```

### 4.2 Create booking with conflict detection

```
Staff fills booking form (client+room+date+slot) → Server Action createBookingAction(input)
  1. requireUser() · zod validate · rooms/clients exist & active
  2. BEGIN
     SELECT ... FROM bookings
     WHERE room_id = $1 AND status IN ('confirmed','pending_conflict')
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2, $3, '[)')
     → overlap found?
       └─ YES → ROLLBACK → compute up to 4 alternative slots
                 (same room, nearest in time; then other rooms, same slot)
                 → return { ok:false, code:"conflict",
                            conflict: { bookingId, title, booker },
                            suggestions: [slot ×≤4] }
                 UI: warning banner (Warning tint) + suggestions +
                     “Request change” CTA
       └─ NO  → INSERT bookings (status 'confirmed') → COMMIT
  3. revalidatePath('/calendar'); revalidatePath('/dashboard')
  4. notify incumbent on conflicts only via change request (see 4.3)
  5. audit booking.create
```

There is **no silent double-booking**. A conflict never inserts; it returns a structured warning. The only ways forward: pick a suggested slot, pick another room/time, cancel, or open a **change request** against the incumbent booker.

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
/inbox loads no mail server-side; the client calls GET /api/mail/messages?folder=INBOX|Sent
             (last 20, bounded ~120-char previews via PARTIAL BODY.PEEK)
Message click → GET /api/mail/message?uid&folder → sanitized HTML (sanitize-html allowlist)
             → <iframe sandbox="allow-same-origin"> (no allow-scripts), images off by default
Reply → POST /api/mail/reply → send via nodemailer as makrich@eiden-group.com,
             In-Reply-To/References set, quoted original = plain-text excerpt (HTML stripped)
             → best-effort APPEND of the reply to Sent via IMAP
No delete, no move; only the \Seen flag (read state) is written. No mail route audits today.
Only MAILBOX_ALLOWED is ever opened (boot-time guard: MAILBOX_ALLOWED must equal IMAP_USER).
```

## 5. Module map

| Module | Route | Purpose | Key actions |
|---|---|---|---|
| Dashboard | `/dashboard` | Today: rooms in use, my bookings, pending requests, KPIs | RSC via `lib/dashboard-live.ts` |
| Calendar | `/calendar` | Rooms × time grid; day/week/month; conflict UI | `createBookingAction`, `updateBookingAction`, `cancelBookingAction` |
| Formations | `/formations` | Training formations CRUD, waitlist, attendance | `createFormationAction`, `enrollParticipantAction`, `markAttendanceAction`, `importParticipantsAction`, `cancelBookingAction` |
| Clients | `/clients` | Client directory, history, links to bookings/formations | `createClientAction`, `addClientNoteAction`, `anonymizeClientAction` |
| Plans | `/plans` | Formation pacing/cohort planning across weeks | `createPlanAction`, `updatePlanStatusAction`, `addPlanTaskAction`, `cyclePlanTaskAction` |
| Reports | `/reports` | Occupancy, utilization, per-room/per-client activity (Recharts) | RSC via `lib/reports-live.ts`; client-side CSV export |
| Inbox | `/inbox` | makrich@eiden-group.com mailbox: search/read/mark-read/reply | `/api/mail/*` (route handlers), `markNotificationsReadAction` (in-app) |
| Settings | `/settings` | Admin: org settings, mail test, categories, rooms | `updateBusinessProfileAction`, `updateWorkingHoursAction`, `createRoomAction`, `testMailConnectionAction` |
| Profile | `/profile` | Self-service: name, language, password change (forced on first login) | `updateProfileAction`, `changePasswordAction` |
| Notifications | `/notifications` | In-app notification feed (Realtime) | `markAllNotificationsReadAction`, `markNotificationsReadAction` |
| Requests | `/requests` | Change-request queue (incoming approvals, outgoing tracking) | `respondToChangeRequestAction`, `cancelChangeRequestAction`, `requestChangeAction` |
| Team (admin) | `/settings/team` | Provision users, temp passwords, deactivate/ban | `createTeamUserAction`, `setTeamUserActiveAction`, `updateTeamUserAction` |
| Audit log (admin) | `/settings/audit` | Search/filter audit events, client-side CSV export | `listAuditLogAction` |

Route groups: `app/(app)/*` for the authenticated shell, `app/(public)/*` for login/forgot/reset. Admin-only pages live under `app/(app)/settings/*` and re-check `role === 'admin'`. i18n via next-intl with `messages/en.json` / `messages/fr.json`; locale from cookie, switch in settings/profile; **every key exists in both files**.

## 6. Environments

| | Local | Staging | Production |
|---|---|---|---|
| URL | http://localhost:3000 | Vercel staging project (`*.vercel.app` alias or `staging-calendar…` if a domain is attached) | **https://calendar.eiden-group.com** |
| Branch → deploy | n/a | PRs / `staging` branch | `main` (after migration push) |
| Supabase project | local CLI or dev free project | staging free project | prod free project |
| `NEXT_PUBLIC_SUPABASE_URL` | dev project | staging project | prod project |
| Email | sandbox: real SMTP but to test mailboxes only | Hostinger, test recipients | Hostinger, real recipients |
| `CRON_SECRET` | any dev string | unique | unique |
| `BUSINESS_PUBLIC_URL` | `http://localhost:3000` or eiden-group.com | eiden-group.com | `https://eiden-group.com` |

**Free-tier pooling note (Supabase):** both staging and prod are **free tier**: ~1 GB DB, **no PITR**, projects **pause after ~7 days of inactivity**. Serverless invocations are short-lived and numerous, so use the **Supavisor pooler (port 6543, transaction mode)** for app traffic; keep the **direct connection (port 5432)** for migrations/`pg_dump` only. If a project is paused, the app 500s: resume it in the Supabase dashboard (see docs/RUNBOOK.md §9).

## 7. Security boundaries

- **RLS default-deny** on every table; `is_admin()` (security-definer, `search_path = public`) gates admin-only rows/actions.
- **Server re-checks**: every Server Action/route handler calls `requireUser()` and, for admin paths, `requireAdmin()`: RLS is a backstop, never the only gate.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) is imported only in `lib/supabase/service.ts` (server-only by convention: it has no `server-only` import yet; worth adding). Never in `NEXT_PUBLIC_*`. Only for user provisioning and bans; everything else goes through the RLS-scoped per-request client (`lib/supabase/server.ts`).
- Auth cookies: httpOnly, `Secure` (prod), `SameSite=Lax`, refreshed in middleware.
- CSRF: Server Actions get framework-level `Origin`/`Host` enforcement (Next.js), SameSite=Lax cookies add a second layer; route handlers that mutate require the cron bearer.
- Mail rendering: sandboxed iframe (no `allow-scripts`), sanitize-html allowlist, images off by default, attachments always force-downloaded (no magic-byte sniffing): full matrix in docs/SECURITY.md §2.7.
- Full control inventory, threat model and incident skeleton: **docs/SECURITY.md**.

## 8. Performance

- **RSC + streaming**: data-dependent sections wrapped in `<Suspense>` with skeletons; static shells (frosted header, nav) prerendered.
- **Cache**: reference data (rooms, categories, settings) cached server-side with short TTL/tag; mutations call `revalidatePath`/`revalidateTag`. No client cache library.
- **Bundle budget**: aspirational (not measured, not enforced in CI): shared ≤ **180 kB gzip**, any route ≤ **250 kB gzip**. Recharts ships in the client bundle of `/reports` (a client component rendered inside an RSC + Suspense page); tree-shaken lucide imports (`import { X } from 'lucide-react'`).
- **DB**: indexes on `bookings(room_id, starts_at, ends_at) WHERE status in ('confirmed','pending_conflict')`, `bookings(starts_at)`, `change_requests(status, expires_at)`, `audit_log(created_at)` (see `0003_indexes_triggers.sql`); keep `explain analyze` in PRs that change hot queries.
- **Images**: `next/image` only; mail images never proxied.
- **Web Vitals**: LCP < 2.0s on `/dashboard` is the goal; it is not measured and not asserted in CI.

## 9. Folder structure

```
eiden-calander/
├─ app/
│  ├─ layout.tsx  page.tsx  globals.css  icon.svg
│  ├─ (app)/             # authenticated shell: dashboard … settings, inbox, requests
│  │  ├─ layout.tsx      # frosted header + nav, requireUser()
│  │  └─ dashboard|calendar|formations|clients|plans|reports|inbox|requests|notifications|profile|settings/
│  ├─ (public)/login|forgot-password|reset-password/
│  ├─ actions/           # "use server" mutations (app/actions/*.ts)
│  └─ api/
│     ├─ cron/expire-requests/route.ts
│     └─ mail/{messages,message,reply,attachment,test,test-send}/route.ts
├─ components/
│  ├─ brand/   NowBar.tsx (mark, wordmark, lockup)
│  ├─ EmptyState.tsx  (shared empty/loading state)
│  └─ <module>/ feature components (client components, only where interactive)
├─ lib/
│  ├─ supabase/{client,server,service}.ts  database.types.ts
│  ├─ live-data.ts dashboard-live.ts reports-live.ts clients-live.ts plans-live.ts
│  ├─ slots.ts conflict.ts audit.ts notifications.ts intl-locale.ts
│  ├─ mail/      imap.ts mime.ts sanitize.ts rate-limit.ts   # server-only
│  ├─ email/     templates.ts send.ts notify.ts              # transactional mail
│  └─ demo-data.ts demo-store.ts                             # bundled fallback dataset
├─ messages/{en.json,fr.json}
├─ supabase/
│  ├─ migrations/  seed.sql
├─ scripts/create-admin.mjs
├─ e2e/               (playwright)
unit tests live next to the code (lib/*.test.ts, Vitest)
├─ docs/           (this folder)
└─ public/
```

> Keep this file in sync with the tree: update it in the same PR that moves a boundary.

## 10. CI pipeline (GitHub Actions)

`push`/PR → **typecheck** (`tsc --noEmit`) → **lint** (`eslint`) → **build** (`next build`, works without secrets) → **audit** (`npm audit --audit-level=high`, non-blocking warning) → **i18n key parity** (en/fr). Vercel handles preview/production deploys (docs/RUNBOOK.md §3); migrations deploy separately (`supabase db push` or the SQL editor). **Unit tests (`npm test`, Vitest) and e2e (`npm run e2e`, Playwright) do not run in CI**; run them locally before opening a PR. Types-drift check is not automated either; regenerate with `supabase gen types typescript --linked > lib/supabase/database.types.ts`.

## 11. ADR register

Architecture decisions (and why) live in `docs/adr/NNNN-title.md` as they are made: e.g. 0001: RLS-default-deny + server re-checks; 0002: no OAuth, email+password only; 0003: change-request workflow instead of silent double-booking; 0004: route handlers only for cron/mail/export; 0005: free-tier Supabase with weekly `pg_dump`. Add an ADR with every decision that future contributors would otherwise re-litigate.
