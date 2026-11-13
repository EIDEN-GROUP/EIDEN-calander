# CALENDAR. — Runbook

Operational guide for **CALENDAR.** (Eiden Group internal scheduling). Environments, deploys, env vars, DNS, mail, troubleshooting, monitoring. For security controls see docs/SECURITY.md; for dev conventions see docs/AGENTS.md.

## 1. Environments & URLs

| Env | URL | Hosting | Database | Notes |
|---|---|---|---|---|
| Local | http://localhost:3000 | `npm run dev` | Supabase dev/staging project or local CLI | `.env.local`, never committed |
| Staging | Vercel staging project — `*.vercel.app` alias (or `staging-calendar…` if/when a staging domain is attached) | Vercel | Supabase **staging** free-tier project | Deployed from PRs / `staging` branch |
| Production | **https://calendar.eiden-group.com** | Vercel | Supabase **production** free-tier project | Deployed from `main`, only after migration push |
| Public site (untouched) | https://eiden-group.com | Eiden Group's own hosting | — | Apex apex stays as-is; we never point it at Vercel |

Vercel projects: one repo, two projects (staging, prod) or one project with branch-scoped envs — either is fine; what must hold: **prod env vars only on prod scope**, **staging shares nothing with prod**, and the prod deployment is reachable only at `calendar.eiden-group.com`.

## 2. Provisioning checklist (one-time per environment)

1. Supabase project created (free tier) → note project ref, anon key, service-role key, DB password.
2. `supabase init` already present; link: `supabase link --project-ref <ref>`.
3. Migrations applied: `supabase db push` (or SQL editor, see §4).
4. Admin user created (see §6).
5. Env vars set in Vercel (scope: staging vs production) — see §5.
6. DNS for prod (§7).
7. UptimeRobot monitor + alert to contact@eiden-group.com (§11).
8. First `/settings/mail` connection test → green (§8).

## 3. Deploy steps

### Preview / staging (per PR)

1. Open PR → Vercel builds a **preview deployment** automatically.
2. Preview envs use **staging** Supabase + staging SMTP recipients. Never point previews at prod.
3. Staging smoke: Playwright suite runs against the preview URL (CI §10 of ARCHITECTURE.md); a human checks `/dashboard` once.
4. Merge after review (no self-merge — docs/AGENTS.md).

### Production (merge to `main`)

**Migrations go first, deploys second.** Production uses forward-fix only — never destructive rollbacks (no `drop column` to "undo"; write a corrective migration).

1. Check open schema changes: `supabase migration list --linked`.
2. Apply migrations: `supabase db push` (needs `SUPABASE_DB_URL`/direct connection — **direct 5432, not the pooler**) **or** paste each new migration into the Supabase SQL editor **in order** and run. Confirm `supabase migration list` shows all applied.
3. Sanity-check prod DB (§9 backup, spot-check RLS on the two most-sensitive tables).
4. Merge PR → Vercel deploys prod.
5. Post-deploy: `/login` loads, `/settings/mail` test green, spot-check one booking round-trip, check audit log for `auth.login.success`.
6. **If the deploy breaks**: fix forward (new commit) — do not "revert and forget"; schema and code move together. If the DB is ahead of the code and something is on fire, disable the feature via the kill-switch setting or hotfix the code — never roll back the DB.

### Preview DB resets

Staging DB is disposable: `supabase db reset` locally or drop/recreate the staging project quarterly. **Prod is never reset.**

## 4. Pushing migrations (detail)

```bash
# from repo root, prod project linked
supabase migration list --linked        # see what is pending
supabase db push                        # applies supabase/migrations/*.sql in order
# alternative: SQL editor — paste migration files in filename order, run each once
```

Rules:

- Migrations are **immutable once applied**. Mistake → new forward-fix migration.
- Every migration must be **idempotent-safe to re-read** but is applied exactly once (`supabase_migrations.schema_migrations` tracks this).
- Backfills and table rewrites run in off-peak hours (00:00–06:00 Casablanca) and announce in the team channel first.
- Verify after push: `select * from supabase_migrations.schema_migrations order by version;` and `\d+ <table>` in the SQL editor.
- RLS changes require the Database Engineer's sign-off (see docs/AGENTS.md role #4) and a matching update to docs/SECURITY.md §2.2.

## 5. Environment variables

All values live in Vercel (Production/Preview scopes) or `.env.local`. `.env.example` documents the set — **never commit real values**. `NEXT_PUBLIC_*` are inlined into the client bundle (public); everything else is **server-only**.

| Variable | Scope | Required | Example / notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | ✅ | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | ✅ | anon public key (RLS still applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | ✅ | Full-privilege key. Only for user provisioning (`lib/supabase/admin.ts`). **Never** in client code, logs, or error messages. |
| `SUPABASE_DB_URL` | **server-only** | ✅ (CLI/ops) | `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres` — direct connection for migrations/`pg_dump`, **not** used by the app runtime (app uses the pooler via Supabase client). |
| `SMTP_HOST` | **server-only** | ✅ | `smtp.hostinger.com` |
| `SMTP_PORT` | **server-only** | ✅ | `587` (STARTTLS, recommended) or `465` (implicit TLS) |
| `SMTP_USER` | **server-only** | ✅ | `contact@eiden-group.com` |
| `SMTP_PASSWORD` | **server-only** | ✅ | Mailbox password from hPanel → Emails. Placeholder `CHANGE_ME` in `.env.example`. |
| `EMAIL_FROM` | **server-only** | ✅ | `Eiden Group <contact@eiden-group.com>` |
| `IMAP_HOST` | **server-only** | ✅ | `imap.hostinger.com` |
| `IMAP_PORT` | **server-only** | ✅ | `993` (TLS only; 143/STARTTLS is not supported by this app) |
| `IMAP_USER` | **server-only** | ✅ | `contact@eiden-group.com` (same mailbox as SMTP) |
| `IMAP_PASSWORD` | **server-only** | ✅ | Usually same as `SMTP_PASSWORD` |
| `MAILBOX_ALLOWED` | **server-only** | ✅ | `contact@eiden-group.com` — the only mailbox the inbox will ever touch. Enforced as a constant; changing it requires a code change. |
| `CRON_SECRET` | **server-only** | ✅ | Random 32+ bytes; `Authorization: Bearer` for `/api/cron/*`. Rotate on suspicion. |
| `BUSINESS_PUBLIC_URL` | public-ish (server-read) | ✅ | `https://eiden-group.com` — used to link the company's public site in outgoing mail; **not** the app URL |

Change management: adding/renaming a var = update `.env.example`, this table, and Vercel in the same PR. Redeploy after any `NEXT_PUBLIC_*` change (they are build-time inlined).

## 6. Bootstrap the first admin

Run once per environment, after migrations are applied:

```bash
export SUPABASE_DB_URL=postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
node scripts/create-admin.mjs --email admin@eiden-group.com --name "Admin Name"
```

The script creates (or reuses) the auth user, sets a **one-time temp password** printed to stdout, and upserts `profiles` with `role = 'admin'`. The admin is forced to change the password at first login. Store the temp password in 1Password, send it via a different channel than the welcome email. Every subsequent user is created the same way from **Settings → Users** (there is no self-service sign-up).

## 7. DNS & mail

- **App**: CNAME `calendar.eiden-group.com` → `cname.vercel-dns.com` (Vercel dashboard → domain → DNS records). SSL is automatic (Let's Encrypt). The **apex `eiden-group.com` is Eiden Group's public site and is never moved**; only the `calendar` subdomain points at Vercel.
- **Mail (Hostinger)**: transactional mail is sent **as** `contact@eiden-group.com` via Hostinger SMTP — same domain, so SPF/DKIM already pass for the mailbox domain (verify in hPanel → Emails → "DNS / deliverability"; keep the SPF include for Hostinger and DKIM selector intact). If deliverability regresses: check DMARC alignment, and that `EMAIL_FROM` uses the exact mailbox address.
- **Inbound**: the in-app Inbox reads `contact@eiden-group.com` via IMAP over TLS (`imap.hostinger.com:993`). It is **read/search/mark-read/reply only** — no delete, no move. Never point IMAP at any other mailbox; `MAILBOX_ALLOWED` is a hard constant.

## 8. Hostinger mail — connection settings

| Purpose | Host | Port | Encryption | Auth |
|---|---|---|---|---|
| SMTP (outbound) | smtp.hostinger.com | 587 | STARTTLS | `contact@eiden-group.com` + mailbox password |
| SMTP (alt) | smtp.hostinger.com | 465 | SSL/TLS | same |
| IMAP (inbound) | imap.hostinger.com | 993 | SSL/TLS | same |

Diagnose from the app: **Settings → Mail → “Test connection”** exercises both (SMTP `transporter.verify()` + IMAP `connect` + `mailboxOpen`). Both must be green before a deploy. Outside the app:

```bash
nc -vz smtp.hostinger.com 587 && nc -vz imap.hostinger.com 993
```

## 9. Troubleshooting

### 9.1 A user is locked out (5 failed logins → 15-minute lockout)

- Preferred: **Settings → Users → (user) → “Unlock”** (clears the counter + `locked_until`, audits `user.unlock`).
- Fallback SQL (as `postgres` in the SQL editor — column names per migrations):

  ```sql
  update public.login_attempts set failed_count = 0, locked_until = null where email = 'user@eiden-group.com';
  -- or, if lockout lives on profiles:
  update public.profiles set locked_until = null, failed_logins = 0 where id = '<user-uuid>';
  ```

- If the *admin* is locked out and no admin UI is reachable, run the SQL above as `postgres`. If the admin password is lost: `node scripts/create-admin.mjs --email … --name … --reset-password` (or Supabase dashboard → Authentication → user → "Send recovery"), then re-enroll.

### 9.2 RLS denials (`42501` / "row-level security" errors)

1. Confirm the session is valid: have the user sign out/in (stale JWT → role re-check passes app-side but RLS sees an old `role` claim).
2. In the SQL editor: `select public.is_admin();` while impersonating the user isn't possible directly — instead test the predicate as the user would see it: check the policy definitions on the table (`select * from pg_policies where tablename = '…'`) for the `using`/`with check` clauses; verify they match `auth.uid()` / `is_admin()`.
3. Common causes: policy missing for the table after a new table was added without RLS (**every new table ships with RLS enabled + explicit policies — see docs/AGENTS.md role #4**), policy references a renamed column, or the query runs as the service role with a *wrong* `search_path`.
4. Never "fix" by disabling RLS or granting `anon` broad policies — fix the policy.
5. Backend actions log `audit_log` failures — filter `action like '%error%'`/`result='failure'` for the user's requests and timestamps.

### 9.3 Missing / wrong env vars

- **Build fails on `NEXT_PUBLIC_*`**: inlined at build time; set in Vercel scope, then redeploy (a redeploy is required even for a "fixed" value).
- **Runtime `undefined` on server vars**: check Vercel → Settings → Environment Variables scope (Production vs Preview); confirm a redeploy happened after the change; confirm no trailing newline (paste carefully — this has bitten us).
- **`SUPABASE_SERVICE_ROLE_KEY` rejected**: key was rotated (see §9.6) — update all scopes and redeploy; the app must fail closed, not fall back to the anon key.
- **`CRON_SECRET` mismatch**: `/api/cron/expire-requests` 401s — Vercel Cron sends the header automatically; test manually with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://calendar.eiden-group.com/api/cron/expire-requests`.

### 9.4 Supabase free-tier project paused (app 500s)

Free projects pause after **~7 days of inactivity**; PostgREST/Auth return errors and every page 500s.

1. https://supabase.com/dashboard → select the project → **Resume project** (2–10 minutes).
2. Re-run the mail test and a login to confirm.
3. Prevention: (a) staff use keeps it warm; (b) UptimeRobot pings the app (§11) — note a static ping does **not** touch Postgres; (c) **weekly `pg_dump`** (§9.5) doubles as a keep-alive; (d) optionally a GitHub Actions cron every 3–4 days issuing a trivial authenticated REST call (`GET /rest/v1/settings?select=key&limit=1` with the anon key) — full read traffic is what unpauses a project.
4. If the dashboard says the project is *over quota* (500 MB DB / 1 GB storage), storage cleanup or an upgrade decision is required — escalate to Eiden Group leadership.

### 9.5 Weekly `pg_dump` (mandatory — no PITR on free tier)

Weekly, off-peak (e.g. Monday 05:00), run and store securely:

```bash
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --file="calander-prod-$(date +%F).dump"
# verify: pg_restore --list calander-prod-<date>.dump | head
# store: encrypted container/1Password vault, retention ≥ 8 weeks, never in git
```

Also export `audit_log` to CSV monthly (Settings → Audit → Export) as a second, human-readable artifact.

**Restore outline (disaster recovery):**

1. Create a new Supabase project (or the paused/broken one once accessible).
2. `pg_restore --no-owner --dbname="$NEW_DB_URL" calander-prod-<date>.dump`.
3. Re-check: RLS enabled on all tables (`select tablename, rowsecurity from pg_tables where schemaname='public'` — all must be `t`), policies present (`pg_policies`), migrations table consistent.
4. Point Vercel envs at the new project; redeploy; rotate `SUPABASE_SERVICE_ROLE_KEY` (§9.6) if compromise is suspected; recreate storage buckets if wiped (branding uploads — re-upload from asset store).
5. RPO = 7 days (weekly dump) + since last daily writes. State this to stakeholders honestly during any incident.

### 9.6 Rotating the service-role key / SMTP credentials

**Service-role key** (suspected leak — logs, screenshot, departed employee):

1. Supabase dashboard → Settings → API → **Reset `service_role` secret**.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in **all** Vercel scopes (Production, Preview) and any CI secrets.
3. Redeploy; verify provisioning path: `/settings/users` → create a throwaway user → delete it.
4. Old key is dead instantly; anon key unaffected (it is public by design).
5. Audit anything the key could have touched during the exposure window (`audit_log` export, Supabase logs).

**SMTP/IMAP password** (mailbox compromise or rotation policy):

1. hPanel → Emails → contact@eiden-group.com → change password.
2. Update `SMTP_PASSWORD`, `IMAP_PASSWORD` in all Vercel scopes; redeploy.
3. Settings → Mail → Test connection (SMTP + IMAP must both go green).
4. Check Hostinger webmail Sent folder for anything the app didn't send; report to security@eiden-group.com if so.
5. `CRON_SECRET` rotation: generate new secret, update Vercel, redeploy, verify `/api/cron/expire-requests` 200s with the new secret.

## 10. Monitoring & alerting

| Signal | Tool / place | Frequency | Alert target |
|---|---|---|---|
| Uptime (prod) | UptimeRobot HTTPS monitor on `https://calendar.eiden-group.com/login` | 5 min | contact@eiden-group.com (+ WhatsApp/phone for P1) |
| Uptime (staging) | Same, staging URL | 15 min | — |
| SSL cert expiry | UptimeRobot SSL check (Vercel auto-renews; alert at 14 days as a safety net) | 1 day | contact@eiden-group.com |
| Mail path health | **Settings → Mail → Test connection** (SMTP verify + IMAP open) | On demand + before each prod deploy | — |
| Cron health | Vercel → Cron Jobs logs; `change_requests` stuck in `pending` past TTL | Daily | contact@eiden-group.com |
| Audit anomalies | Settings → Audit: filter `result=failure`, `user.unlock`, `auth.login.lockout`, `export.audit` | Weekly review | security@eiden-group.com |
| Audit export archive | Settings → Audit → Export (CSV) | Monthly | secure vault |
| Backup | `pg_dump` per §9.5 | Weekly | runbook owner |
| Dependencies | Dependabot PRs + CI `npm audit --omit=dev --audit-level=high` gate | Weekly | maintainers |

## 11. Common admin procedures

- **Add a user**: Settings → Users → New (name, email, role). A temp password is shown **once** — copy it to 1Password and send via your preferred channel. User changes it at first login.
- **Deactivate a user**: Settings → Users → Deactivate (soft — sessions revoked, account can't log in, rows/history preserved). Preferred over deletion.
- **Reset a user password**: Settings → Users → Reset → new temp password (old one invalid immediately).
- **Rooms/categories**: Settings → Rooms / Categories — changes revalidate all calendar views; deleting a room with future active bookings is blocked with a warning (reassign first).
- **Audit log questions** ("who changed booking X?"): Settings → Audit → filter by `entity_id`.
