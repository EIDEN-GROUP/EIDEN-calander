# CALENDAR. — Launch checklist
**Phase 5 · Eiden Group · v1.0 RC**

Use this before pointing the DNS record and after go-live. Everything reversible or auditable; nothing here leaves gaps.

## Pre-flight (before DNS cutover)
- [ ] Production Supabase project created/linked; schema applied (0001–0006); demo seed **skipped** in prod
- [ ] First admin created via `node scripts/create-admin.mjs --email makrich@eiden-group.com --name "Eiden Group"` — temp password delivered once, rotate immediately
- [ ] Vercel project connected to GitHub repo `EIDEN-GROUP/EIDEN-calander`; **root = repo root**; framework preset Next.js
- [ ] Environment variables set in Vercel (Production + Preview):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
  `SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM`, `IMAP_*`, `MAILBOX_ALLOWED=makrich@eiden-group.com`,
  `CRON_SECRET`, `BUSINESS_PUBLIC_URL=https://calendar.eiden-group.com`
- [ ] DNS: `calendar CNAME cname.vercel-dns.com` (apex `eiden-group.com` untouched — it's the public site)
- [ ] Preview deployment green end-to-end: login, conflict flow, CSV export, cron 401/200
- [ ] Resend/Hostinger DKIM+SPF verified for outbound mail (Hostinger dashboard) — or accept deliverability limits
- [ ] Uptime monitor pinging `https://calendar.eiden-group.com/login` every 5 min (the free-tier Supabase pauses when idle)
- [ ] Cron `/api/cron/expire-requests` registered and returning 200 with the bearer token (hourly)
- [ ] Backups: weekly `pg_dump` via `SUPABASE_DB_URL` stored off-machine (Google Drive / iCloud folder shared with admin)

## Go
- [ ] Merge to `main` → Vercel production build green
- [ ] Smoke: /login → auth → /dashboard; create booking; right-click → context menu; /reports renders; /inbox loads real mail
- [ ] Admin walks through Settings top to bottom once (General, Categories, Rooms, Team, Working hours) and enters the real rooms + categories

## First week (hypercare)
- [ ] Watch Vercel + Supabase logs for errors on every route
- [ ] Check audit log daily for unexpected activity
- [ ] Collect staff feedback; file into `docs/agents/` reports
- [ ] Confirm email delivery to a real inbox (booking confirmation, change request, temp-password)
- [ ] Verify `pg_dump` restore on a scratch project once (or at least `pg_restore --list`)

## Rollback
- DNS back to previous host (if any) or Vercel instant rollback → Deployments → Revert; DB forward-fix only (never down-migrate)
- Service/SMTP keys: rotate in Vercel env → redeploy; Supabase service key: Settings → API → new key → update env → redeploy → revoke old

## Post-launch decisions waiting on you
- Public booking page (v1.1)
- Stripe / deposits & invoicing
- WhatsApp reminders
- i18n EN/FR dictionaries + next-intl wiring
- Automated Playwright suite in CI on every PR (scaffolded in `e2e/`)
