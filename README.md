# CALENDAR. — Architecture for Time.

**CALENDAR.** is Eiden Group's internal scheduling system — a shared-workspace web app for running the company's room business and training operations across the Casablanca and Agadir locations. Staff manage the full booking lifecycle, clients, formations, plans and reports; admins additionally manage users, settings, categories, rooms and the audit log.

| | |
|---|---|
| **Product** | CALENDAR. |
| **Tagline** | Architecture for Time. |
| **Entity** | Eiden Group — https://eiden-group.com |
| **Type** | Internal business app (not public, not open source) |
| **Market / locations** | Casablanca &amp; Agadir, Morocco |
| **Languages** | English &amp; French (next-intl) |
| **Audience** | Eiden Group staff (admins + staff) |

> **Screenshot:** not yet captured — the UI is under active construction. The visual system, mark and component specs live in [docs/BRAND.md](docs/BRAND.md); a dashboard screenshot will be added at `docs/assets/screenshot-dashboard.png` before launch.

## What it does

- **Bookings & rooms** — staff book meeting rooms for clients and formations. Same room + overlapping active booking → the app warns, suggests up to 4 alternative slots, and can open a *change request* to the incumbent booker instead of silently double-booking.
- **Formations** — create and track training formations (dates, room, cohort, client) with reporting.
- **Clients** — client records linked to bookings and formations.
- **Plans** — formation pacing/cohort planning over weeks.
- **Reports** — occupancy and activity reports (Recharts), CSV export.
- **Inbox** — an in-app view of the `makrich@eiden-group.com` mailbox over IMAP: search, read, mark-read, reply. Read/reply only — never delete or move; Hostinger remains the source of truth.
- **Notifications** — in-app + email notifications for bookings, change requests and expiry.
- **Admin** — user provisioning with one-time temp passwords (no OAuth), settings, categories, rooms, full audit log.

Access is restricted to provisioned Eiden Group accounts. There is intentionally **no public sign-up and no OAuth** — admins create accounts.

## Quick start

```bash
# 1. Install dependencies
npm install
# If you hit npm cache EACCES (permission errors on ~/.npm):
#   npm install --cache /path/to/writable/cache
#   or: npm config set cache /path/to/writable/cache

# 2. Configure environment
cp .env.example .env.local
#    then fill in the real values (ask an admin / see docs/RUNBOOK.md §Env vars)

# 3. Run the dev server
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/login`. Sign-in requires a provisioned account; ask an admin to create one (see "Bootstrap the first admin" in [docs/RUNBOOK.md](docs/RUNBOOK.md)).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint (`eslint-config-next` core-web-vitals + TypeScript) |

Test scripts (`npm test` — Vitest unit, `npm run test:e2e` — Playwright) land together with the first test-covered features; the gates are specified in [docs/AGENTS.md](docs/AGENTS.md#definition-of-done).

## Architecture in one line

Next.js 16 App Router (RSC by default, Server Actions for mutations) + Supabase (Auth/Postgres/RLS/Storage/Realtime) + nodemailer (outbound SMTP) + imapflow (inbound IMAP), deployed on Vercel.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Deployment

- **Production**: Vercel → `https://calendar.eiden-group.com` (CNAME → `cname.vercel-dns.com`; the apex `eiden-group.com` is Eiden Group's public site and stays untouched).
- **Staging**: separate Vercel project / staging branch, separate Supabase project (free tier).
- **Flow**: PR → preview deployment → staging; merge to `main` → production **only after** DB migrations are pushed explicitly (`supabase db push` or the SQL editor). Forward-fix only — never destructive rollbacks.
- **Supabase** stays on the free tier (staging + prod): no PITR, so a weekly `pg_dump` and a keep-alive ping are mandatory — see [docs/RUNBOOK.md](docs/RUNBOOK.md).

Full runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md)

## Documentation

| Doc | Contents |
|---|---|
| [docs/BRAND.md](docs/BRAND.md) | Brand system for developers — mark, tokens, type, geometry, components |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, rendering strategy, data access, flows, module map, folder structure |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Environments, deploys, env vars, DNS, mail, troubleshooting, monitoring |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, control inventory, audit events, pen-test checklist |
| [docs/AGENTS.md](docs/AGENTS.md) | How AI subagents work this repo — conventions, roles, review flow, DoD |
| [PLAN.md](PLAN.md) | Product plan (if present in your checkout) |

## License

Proprietary — © Eiden Group. All rights reserved. Internal use only; no copying, distribution or public deployment without written permission from Eiden Group. **Not licensed for open source.**
