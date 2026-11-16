# DATABASE.md: CALENDAR. (Eiden Group internal scheduling)

PostgreSQL 15+ / Supabase. One database, one business (Eiden Group, eiden-group.com),
**shared workspace**: every authenticated user sees all data; access is controlled by
role: `admin` (full admin) and `staff` (operations only). The only isolation boundary
in RLS is admin-vs-non-admin; everyone else works on the same dataset.

Two Supabase projects exist: **staging** and **production** (free tier). Both receive
the identical migration set. `seed.sql` is for staging/local only.

## Applying the migrations

Fresh, empty project required. Files live in `supabase/migrations/` and must run **in
order**: `0001` → `0008`.

**Option A: Supabase dashboard SQL editor (recommended for staging/prod):**
Project → SQL Editor → New query → paste each file, in order, and run one file per query.

**Option B: psql:**
```bash
export SUPABASE_DB_URL='postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_extensions_enums.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_tables.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_indexes_triggers.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_functions.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0005_rls.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_booking_status_paused.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0007_log_audit_event.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0008_notification_prefs_locale_brand.sql
```
Connection string: Dashboard → Project Settings → Database → Connection string → URI.
Use the direct connection or session pooler (transaction pooler does not support all
DDL/session state). For the Next.js app at runtime, use the pooler URL from the app side.

Sanity checks after applying:
```sql
select count(*) from public.working_hours;      -- 7  (Mon–Sat open 08:00–20:00, Sun closed)
select count(*) from public.categories;         -- 3  (Meeting Room Rental, Formation, Event)
select business_name, public_url from public.business_settings;  -- Eiden Group, https://eiden-group.com
select tablename, rowsecurity from pg_tables where schemaname = 'public';  -- rowsecurity = true for all
```

### First admin user
Migrations create no auth users. Bootstrap the admin once per environment:
```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/create-admin.mjs --email admin@eiden-group.com --name "Marouane Akrich"
```
Creates the auth user (`email_confirm: true`), upserts the `profiles` row as
`role='admin'`, `must_change_password=true`, and prints the temporary password **once**
(never stored; the app must force a password change at first sign-in). Pass
`--password <pwd>` to supply your own. Existing email ⇒ prints an error and exits 1.

## Migration files

| File | Contents |
|---|---|
| `0001_extensions_enums.sql` | Extensions `pgcrypto`, `citext`, `pg_trgm` (`moddatetime` intentionally unused → custom `set_updated_at()`); enum types `user_role`, `booking_type`, `booking_status`, `request_status`, `client_status`, `participant_status`, `formation_status`, `plan_status`, `plan_priority`, `task_status`, `weekday` |
| `0002_tables.sql` | All 14 tables (UUID PKs via `gen_random_uuid()`, `timestamptz not null default now()`) |
| `0003_indexes_triggers.sql` | Indexes (trigram GIN on `bookings.title`, `clients.full_name`; partial index on `bookings(room_id, starts_at, ends_at)` where status ∈ (`confirmed`,`pending_conflict`); …; required baseline data: `working_hours` Mon–Sat open + Sun closed, 3 system `categories`, `business_settings` singleton) |
| `0004_functions.sql` | Functions + triggers (see below) |
| `0005_rls.sql` | Enables RLS on **all** tables, table/sequence privileges, function grants, all policies, adds `notifications` to the `supabase_realtime` publication (skipped silently on plain Postgres) |
| `0006_booking_status_paused.sql` | `booking_status` enum: adds `paused` (an on-hold booking that does not block the room) |
| `0007_log_audit_event.sql` | `log_audit_event()` security-definer RPC (the canonical write path for `audit_log`) |
| `0008_notification_prefs_locale_brand.sql` | `business_settings`: `notification_prefs` jsonb, `hour_cycle`, `date_format`; `brand-assets` Storage bucket (public read, admin-only write, for logos) |

`0003`–`0008` are written to be re-runnable (`if not exists`, `on conflict do nothing`,
`create or replace`, `drop … if exists`). `0001`/`0002` are one-shot. Never edit an
already-applied migration on an environment: add a new `0009_*.sql` instead.

## Table summary

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users` (cascade). Role, active flag, `must_change_password`, locale `en`/`fr`. Created by admins only |
| `business_settings` | Singleton (`id boolean pk check (id)`, value always `true`). Business identity, timezone (`Africa/Casablanca`), currency (`MAD`), slot increment, buffer, min notice. No duplicates possible |
| `working_hours` | One row per weekday (`weekday` PK): open/close times + `is_open` |
| `categories` | Booking categories; `is_system` rows from migration; `type` = standard\|formation; i18n names `name_en`/`name_fr`, color/icon, sort |
| `rooms` | Rentable spaces; capacity/hourly_rate (MAD), amenities `text[]`, soft-toggle `is_active` |
| `clients` | People/companies (`type`); `status` lead/active/inactive; `tags text[]`; **soft delete** via `deleted_at`; `anonymized_at` for GDPR-style anonymization; citext email |
| `bookings` | Core entity. `type` standard\|formation, `status` confirmed/pending_conflict/paused/cancelled/completed, price in client currency. `bookings_ends_after_starts` CHECK |
| `formations` | 1:1 extension of `bookings` (`booking_id` PK). Capacity, description, `price_label` (numeric), `status` draft/open/full/ongoing/completed/cancelled |
| `formation_participants` | Enrolment/attendance per formation; `status` enrolled/confirmed/attended/no_show/cancelled; `waitlist` flag; `checked_in_at` |
| `plans` | Strategic plans/initiatives; status, priority, `target_date`, `progress` 0–100 (auto-computed), `target_date_marker` |
| `plan_tasks` | Tasks under a plan; status todo/in_progress/done; `position`; `completed_at`; delete cascades from plan |
| `change_requests` | Conflict-resolution flow: references `new_booking_id` and `conflicting_booking_id`; requester → assignee; `expires_at` default `now() + 72h`; `suggested_slots jsonb` |
| `notifications` | Per-user in-app notifications; **insert only via security definer** (`notify_user`) or service role; updates limited to `read_at` |
| `audit_log` | Append-only audit trail (`id bigint generated always as identity`). `actor_id` deliberately NOT a hard FK (log survives profile deletion). Writes only via security definer / service role |

## RLS summary

RLS enabled on **all** tables; default deny; **no policy for `anon` anywhere**.
`authenticated` is gated by the policies below; `service_role` bypasses RLS entirely.

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | all authenticated | admin only | own row **without** changing `role`/`is_active` (staff), or any row (admin) | None |
| `business_settings`, `working_hours`, `categories`, `rooms` | all authenticated | admin | admin | admin |
| `clients` | all authenticated, `deleted_at is null` | `created_by = auth.uid()` | any authenticated (shared ops) | admin only (soft-delete preferred) |
| `bookings` | all authenticated | `created_by = auth.uid()` | owner (`created_by`) or admin | admin |
| `formations` | all authenticated | parent booking owner or admin | parent booking owner or admin | admin |
| `formation_participants` | all authenticated | any authenticated | any authenticated | any authenticated |
| `plans` | all authenticated | any authenticated | any authenticated | admin |
| `plan_tasks` | all authenticated | any authenticated | any authenticated | any authenticated |
| `change_requests` | requester / assignee / admin | `requested_by = auth.uid()` | assignee (respond) or requester (cancel only, `status='cancelled'`) or admin | Service role only |
| `notifications` | own rows | **none** (security definer `notify_user` / service role only) | own rows, **`read_at` column only** (column-level grant + policy) | own rows |
| `audit_log` | **admin only** | **none** (definer / service role) | **none** | **none** |

Privilege details in `0005_rls.sql`: `revoke all … from anon`; `grant select, insert,
update, delete … to authenticated` (RLS is the gate); `grant all … to service_role`;
column grant `update (read_at)` on `notifications`; `insert, update, delete` on
`audit_log` revoked from `authenticated`; default privileges aligned for future tables.

`is_admin()` is `stable security definer` (`search_path = public`) reading
`profiles where id = auth.uid() and role = 'admin' and is_active`. Policies call it.
It never recurses because profiles policies don't select from profiles except the
`profiles_self_update` check, which is a plain unguarded `select` covered by the open
`profiles_select_authenticated` policy.

## Functions & triggers (0004_functions.sql)

| Function / trigger | Type | Behavior |
|---|---|---|
| `set_updated_at()` | BEFORE UPDATE trigger fn | Sets `updated_at := now()`. Triggered on `profiles`, `rooms`, `clients`, `bookings`, `plans`, `business_settings` |
| `is_admin()` | SQL `stable`, `security definer` | `true` if the current auth user is an active admin |
| `guard_booking_overlap()` | BEFORE INSERT OR UPDATE on `bookings`, `security definer` | Raises `exception 'room_conflict'` (SQLSTATE `P0001`) when a **confirmed** booking with non-null `room_id` overlaps another confirmed booking of the same room. Self ignored on UPDATE; any non-confirmed status exempt (`pending_conflict`, `paused`, `cancelled`, `completed`). **Bypass for app/SQL editor only:** `set local app.force = '1'` inside the transaction |
| `recompute_plan_progress()` | AFTER INSERT/UPDATE/DELETE on `plan_tasks`, `security definer` | `plans.progress = round(100 × done / total)`; `0` tasks ⇒ `0`. Handles a task being moved between plans |
| `touch_formation_full()` + helper `_touch_formation_full(uuid)` | AFTER INSERT/UPDATE/DELETE on `formation_participants`, `security definer` | Counts `enrolled`+`confirmed`, non-waitlist participants; flips `formations.status` `draft/open → full` at capacity and `full → open` when a seat frees. Never touches `ongoing`/`completed`. `_touch_formation_full` is revoked from app roles |
| `notify_user(p_user_id, p_type, p_title, p_body, p_link, p_entity_id)` | `security definer`, returns `uuid` | Canonical notification writer; inserts into `notifications` |
| `expire_change_requests()` | `security definer`, returns `integer` | For each pending request past `expires_at` (default `now() + 72h`): sets `status='expired'`, `responded_at=now()`, cancels the linked **new booking**, notifies `requested_by` (`change_request_expired`), writes an `audit_log` row. Uses `FOR UPDATE SKIP LOCKED`; idempotent |

Change-request lifecycle: `pending → approved | declined | cancelled | expired`
(`expired` only via `expire_change_requests()`).

## Seed vs. migrations

- **Migrations** = schema + required baseline rows (working hours, system categories,
  business settings singleton). Part of every environment, including production.
- **`supabase/seed.sql`** = demo content for **staging/local only**. Rooms
  (`Salle Grande (DEMO)` 12p 450 MAD Casablanca, `Salle Petite (DEMO)` 6p 250 MAD
  Agadir, `Salle Formation (DEMO)` 20p 600 MAD Casablanca), 5 demo clients, 12 demo
  bookings (incl. one `pending_conflict` overlapping the Grande demo booking to exercise
  the change-request flow), 2 demo formations + 8 participants (the Excel one is exactly
  at capacity → flips to `full` via trigger), 2 plans + 7 tasks. Everything labelled
  `DEMO`. **Never run against production.** Not idempotent: re-running duplicates data;
  reset by deleting `*DEMO*` rows or rebuilding the DB.

## Staging vs. production

Same migration set on both. Staging additionally gets `seed.sql` and may be paused by
the free tier after inactivity (expected). Prod: migrations + `create-admin.mjs` only.
Point each app environment at its own project URL/keys.

## Free-tier notes

- **No `pg_cron` required.** Expiry of change requests is handled by an external
  scheduler: e.g. a Vercel cron hitting an API route hourly that calls
  `rpc('expire_change_requests')` with the **service role** key (protect the route with
  a `CRON_SECRET` bearer check). Safe to call repeatedly (`SKIP LOCKED`, idempotent).
- Realtime: `0005_rls.sql` adds `notifications` to the `supabase_realtime` publication
  when it exists; otherwise it is a no-op (plain Postgres).
- Free tier: 500 MB database, project pauses after ~1 week of inactivity, 2 active
  projects (staging + prod fits). Connection pooler for the app; direct/session pooler
  for DDL. No custom SMTP required at this stage.

## Regenerating the TypeScript types

After every migration, refresh the app's DB types (kept under `lib/`, owned by the app):
```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > lib/supabase/database.types.ts
# or, once `supabase link --project-ref <ref>` has been run:
npx supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts
```

## Caveats / gotchas

- `citext` columns (e.g. `profiles.email`, `clients.email`) compare case-insensitively.
  store emails in any case; lookups are still unique.
- `audit_log.actor_id` has no FK by design (audit survives user deletion).
- `must_change_password` is stored by the DB but **enforced by the app** (redirect after
  sign-in); nothing forces the change at the database level.
- The formation open↔full auto-flip only happens via `formation_participants` trigger;
  changing `formations.capacity` alone does not recompute `status`.
- `plans.progress` is owned by the `plan_tasks` trigger: don't set it manually (it will
  be overwritten on the next task change).
- `0001`/`0002` are not re-runnable; treat migrations as immutable history.
- The `room_conflict` bypass (`set local app.force = '1'`) must never be exposed to the
  browser bundle: service role / SQL editor only.
