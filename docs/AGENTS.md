# CALENDAR. · How AI subagents work this repo

Operating manual for AI subagents building **CALENDAR.** (Eiden Group internal scheduling). Read this **before** touching anything. Product context: docs/ARCHITECTURE.md; brand rules: docs/BRAND.md; security bar: docs/SECURITY.md; operations: docs/RUNBOOK.md.

> **Current state:** the app is built and lives at https://calendar.eiden-group.com (see `docs/LAUNCH_CHECKLIST.md`). Keep `docs/ARCHITECTURE.md` §Folder structure in sync: it is the contract, not aspiration.

## 1. Non-negotiable rules (all roles)

1. **Stay in your lane.** Write only the paths assigned to your role. If a task needs another role's paths, split the work or request it: never "just do it quickly" in someone else's files.
2. **No `any`.** `tsconfig` is `strict`; `as any`, `@ts-ignore`, `@ts-expect-error` (without a linked issue) are review blockers.
3. **Server Actions for mutations**, always: `"use server"`, zod-validated input, auth re-check first, result **discriminated union** `{ ok: true, data } | { ok: false, error: string }` (add `code?: string` for special cases like `conflict`). Never throw for expected failures; never return raw DB errors.
4. **RSC by default.** Client components (`"use client"`) only where interactive (forms, calendar drag, segmented control). Data flows down as props; events flow up as actions.
5. **Brand tokens via CSS vars only.** No hex/rgb literals in components except in `globals.css` `@theme` (and rare SVG attributes in `components/brand`). Tailwind utilities reference tokens: `bg-canvas`, `text-obsidian`, `border-border`, `rounded-pill`…
6. **i18n is not optional.** All user-facing strings via `next-intl`; **every key exists in both `messages/en.json` and `messages/fr.json`**. Hardcoded English in JSX is a review blocker.
7. **DB changes only via the Database Engineer (role #4).** New table/column/index/RLS/RPC = a migration in `supabase/migrations/` + the Engineer's review + docs updated. **Migrations are immutable once applied**: fix forward.
8. **Never commit secrets.** `.env*` is gitignored; `.env.example` gets placeholder-only edits; real values come from the client/admin out-of-band.
9. **Tests don't get deleted to go green.** If a test is wrong, fix the test with justification in the PR; if the code is wrong, fix the code.
10. **Ask, don't assume,** on product/scope ambiguity: check with the Orchestrator or Product Manager; record the decision in the relevant doc.

## 2. Project structure map

```
app/                     App Router (RSC). Route groups: (app) authenticated shell, (public) login/reset. layout.tsx = root shell.
components/brand/        Now-Bar mark, Wordmark, Logo: the only place brand SVG lives.
components/<module>/     Feature components, one folder per module (client components only where interactive)
lib/supabase/            client.ts (browser) · server.ts (RLS per-request) · service.ts (service role, server-only) · database.types.ts (generated)
lib/                     Hand-written typed loaders (live-data, dashboard-live, ...), slots/conflict math
app/actions/             "use server" mutations: zod in, { ok, error } out
lib/mail/                imap.ts · smtp.ts · sanitize.ts: SERVER-ONLY (import 'server-only')
lib/email/templates/     Outbound transactional templates (EN/FR)
messages/                en.json · fr.json (next-intl)
supabase/migrations/     Immutable SQL migrations · supabase/seed.sql (dev-only)
scripts/                 create-admin.mjs etc.: ops scripts, plain node ESM
e2e/                     Playwright · unit tests colocated (lib/*.test.ts, Vitest)
docs/                    This documentation set · docs/agents/<role>-report.md · docs/adr/
docs/assets/             Screenshots & images referenced from README/BRAND
```

## 3. Conventions in detail

- **TypeScript**: strict; DTO/view-model types in `lib/types.ts`; table types only from `database.types.ts` (regenerated in CI: don't hand-edit).
- **Errors**: expected failures → union result; unexpected → thrown, caught by `app/error.tsx` boundary + logged via `lib/log.ts` (structured JSON, no PII/secrets).
- **Validation**: zod schemas co-located with actions (`createBookingSchema`), exported for the client form resolver.
- **Naming**: files kebab/camel consistent with existing (`NowBar.tsx` PascalCase for components; `lib/live-data.ts` camel for modules); DB `snake_case`; CSS vars `--color-*`, `--radius-*`, `--shadow-*`.
- **Dates**: `date-fns`; all times stored UTC timestamptz; render in `Africa/Casablanca`; week starts Monday.
- **Money/labels**: none in v1 (internal app): don't invent.
- **Imports**: `@/*` absolute; no deep relative chains (`../../../`).
- **Logs**: `{ action, actor, entity, result, ms }`; no request/response bodies.
- **CSS**: tokens > utilities; component classes via `@layer components` only for shared patterns; no `@apply` of arbitrary values that can't be expressed with tokens.
- **Git**: one role's branch per unit of work (`role/<n>-<slug>`); commits imperative, scoped (`feat(calendar): …`); PR description links the issue and states the test plan.

## 4. Definition of done (every task, every role)

- [ ] Code builds: `npm run build` green; `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] **Unit tests** (vitest) for logic you added: especially conflict math, request lifecycle, mail sanitization; run `npm test`.
- [ ] **e2e** (Playwright) for new user flows crossing >1 screen or involving auth/mail: add/update spec in `tests/e2e`.
- [ ] i18n: keys in **both** en.json and fr.json; no hardcoded strings; RTL-agnostic layout.
- [ ] a11y: keyboard-reachable, visible focus ring, ≥ 4.5:1 text contrast, alt text, labels; `prefers-reduced-motion` respected.
- [ ] Brand: tokens only, no hex outside `globals.css`; Now-bar only on genuinely active elements.
- [ ] Security: input zod-validated; role re-checked server-side; new/changed table ⇒ RLS policies + docs/SECURITY.md §2.2 (and §3 if new audited actions).
- [ ] `revalidatePath` called where data changes; no manual cache pokes.
- [ ] No secrets in code/logs/diff; `.env.example` updated if vars added; README/RUNBOOK/ARCHITECTURE/AGENTS updated to match reality (docs are part of DoD, not afterthought).
- [ ] Report filed: `docs/agents/<role>-report.md` (see §7) with what changed, how to verify, open items.

## 5. Testing gates

| Gate | Command | When | Blocks |
|---|---|---|---|
| Lint | `npm run lint` | every push | merge |
| Typecheck | `npx tsc --noEmit` | every push | merge |
| Unit | `npm test` (Vitest) | every push | merge |
| E2E smoke | `npx playwright test` | every push (CI) | merge |
| Build | `npm run build` | every push | merge |
| Audit | `npm audit --omit=dev --audit-level=high` | weekly + every dep PR | merge |
| Types drift | `supabase gen types` + diff check | when `supabase/` changes | merge |
| Visual/a11y | Playwright + axe on `/dashboard`, `/calendar`, `/login` | on brand/component changes | merge |
| Migration | `supabase db reset` locally + seed; `pg_policies` sanity | every migration PR | merge |

Gates run locally before PR; CI (docs/ARCHITECTURE.md §10) enforces typecheck/lint/build/i18n parity and a non-blocking npm audit finding, not unit/e2e. **Red gate = no merge, no exceptions** (docs changes excepted only when they provably don't affect code: still need lint-able markdown).

## 6. Code review flow

1. Author opens PR → CI gates → self-description with test plan and screenshots for UI.
2. **No self-merge.** Minimum one approval from another role; schema/RLS/CI/brand-sensitive PRs require the owning role's approval (Database Engineer / DevOps / Design Systems Engineer respectively).
3. Reviewer checks: lanes respected? unions not throws? zod? i18n? tokens? docs updated? audit events where relevant?
4. Squash-merge to `main` by the Orchestrator (or release engineer) after green CI + approvals. `main` is always releasable; staging comes from PRs.
5. Hotfix path: branch off `main`, fix forward, same gates, fast-tracked review (30 min SLA), post-mortem if user-visible.

## 7. Roles (25)

| # | Role | Owns (write access) | Key outputs |
|---|---|---|---|
| 1 | **Orchestrator / Project Lead** | PLAN.md, docs/adr/ sequencing, assignments | Sequencing, unblocking, final merge button, status board |
| 2 | **Product Manager** | PLAN.md, docs/PRD.md, acceptance criteria | Requirements, prioritization, acceptance sign-off |
| 3 | **Solution Architect** | docs/ARCHITECTURE.md, docs/adr/ | Stack decisions, ADRs, module boundaries, review of cross-cutting PRs |
| 4 | **Database Engineer** | supabase/migrations/, seed.sql, `lib/supabase/database.types.ts` (via CI), RLS, RPCs | Schema, policies, migrations, types, query perf |
| 5 | **Backend Engineer** | app/actions/, app/api/cron/*, app/api/mail/*, lib/*-live.ts | Actions, route handlers, cron, notifications pipeline |
| 6 | **Documentation Agent** | README.md, docs/{BRAND,ARCHITECTURE,RUNBOOK,SECURITY,AGENTS}.md, .env.example | This doc set, kept truthful to the code |
| 7 | **Frontend Engineer** | app/, components/<module>/ + app pages/layouts | RSC pages, client components, routing, loading/error states |
| 8 | **Design Systems Engineer** | app/globals.css (tokens/components layer), components/brand/ | Brand tokens, `.frosted`, `.btn-*`, `.segmented`, favicon sources |
| 9 | **Mail Engineer** | lib/mail/, lib/email/, app/api/mail/*, /inbox + /settings/mail UI, rate limits | IMAP/SMTP, sanitization, templates, inbox actions |
| 10 | **Scheduling / Conflict Engineer** | Conflict detection + suggestions in app/actions/bookings.ts + lib/slots.ts + lib/conflict.ts, /requests lifecycle | Overlap math, 4-slot suggestions, change-request state machine |
| 11 | **Formations & Plans Engineer** | formations/ + plans/ modules (app + app/actions/formations.ts + app/actions/plans.ts) | Formation CRUD, cohort/pacing plans |
| 12 | **Clients Engineer** | clients/ module, relationships, history views | Client directory, links, archiving |
| 13 | **Reports Engineer** | reports/ module, /api/export/* (CSV), Recharts views | Occupancy/utilization reports, exports |
| 14 | **i18n / Localization Engineer** | messages/en.json, messages/fr.json, locale routing/switch | Complete key parity, formatting (dates, numbers) per locale |
| 15 | **DevOps / CI Engineer** | .github/workflows/, vercel config, scripts/ maintenance | CI gates, preview/staging/prod pipeline, env management |
| 16 | **QA Engineer** | test plans, docs/qa/, manual regression scripts | Test plans, exploratory passes, release sign-off |
| 17 | **Unit Test Engineer** | tests/unit/ (Vitest), coverage config | Unit suites, fixtures, coverage ≥ 80% on lib/ |
| 18 | **E2E / Automation Engineer** | tests/e2e/ (Playwright), CI e2e job | Critical-flow specs (login, book, conflict, request, inbox reply) |
| 19 | **Security Engineer** | docs/SECURITY.md compliance, headers in next.config.ts, rate-limit implementation review, pen-test execution | Threat model upkeep, audit, pen-test checklist sign-off |
| 20 | **Performance Engineer** | bundle budgets, caching strategy, Suspense boundaries, RPC tuning | Web Vitals, bundle reports, hot-query explain-analyze |
| 21 | **Accessibility Engineer** | a11y audits, aria/focus/keyboard fixes, axe CI | WCAG 2.1 AA conformance evidence |
| 22 | **Audit & Compliance Engineer** | audit_log implementation, retention, export tooling, CNDP notes | Complete event coverage, monthly export, 09-08 alignment |
| 23 | **Release / Deploy Engineer** | Deployments, migrations push, rollbacks (forward-fix), runbook execution | Prod deploys, post-deploy checks, incident-adjacent ops |
| 24 | **Code Reviewer (Integrity)** | reviews across repo (no standing paths) | Adversarial review, spec-vs-code verification, merge gatekeeper with #1 |
| 25 | **Technical Writer** | docs/USER_GUIDE.md, in-app help copy, CHANGELOG.md, onboarding emails/copy | End-user docs (EN/FR), release notes, support macros |

**Report filing.** Each role writes `docs/agents/<role>-report.md` at the end of its unit of work: what changed (paths), how to verify (commands/URLs), assumptions, open items, follow-ups for other roles. The Orchestrator reads these to sequence; reports are also the Paper Trail for audits.

## 8. Coordination rules

- **One role, one checkout.** Don't edit another role's working files; hand off via PRs/reports.
- **Schema via Database Engineer only.** Frontend/Backend need a new column ⇒ issue → role #4 migrates → types regen → consumers update. No side-channel `create table` in app code, ever.
- **Brand via Design Systems Engineer first.** Need a new token/component pattern ⇒ role #8 adds it to `globals.css`/`components/brand|ui` → you consume it. No hex literals, no one-off "temporary" buttons.
- **i18n via role #14** for new namespaces; otherwise add keys to both files yourself and note it in your report.
- **Security touchpoints** (auth, mail, RLS, headers, rate limits, audit) ⇒ role #19 reviews before merge; no exceptions.
- **No self-merge**; no force-push to shared branches; no editing others' reports retroactively (append corrections in your own report).
- **Migrations immutable**; if a migration is wrong post-merge, role #4 writes a corrective migration in the same release.
- **`.env` never committed**; if you spot one staged, stop, tell the Orchestrator, rotate via RUNBOOK §9.6 if it was ever pushed.
- **Docs are living**: behavior changed ⇒ the relevant doc section changes in the same PR.
- **Disagreement**: Orchestrator decides sequencing, Architect decides structure, Product decides scope, Security decides ship/no-ship on security items: their calls are final for the release.
- **Done means merged + deployed + verified**, not "works on my machine".

## 9. Quick task routing

| Ask | Route to |
|---|---|
| "Add a field to bookings" | #2 (requirement) → #4 (migration) → #5/#7 (code) → #17/#18 (tests) |
| "Button looks off-brand" | #8 → #7 consumes |
| "Inbox email renders weird HTML" | #9 (sanitizer/iframe first) → #19 if XSS-adjacent |
| "Calendar double-booking slip" | #10 + #4 (constraint) → #19 audit review |
| "New env var needed" | #5 implements → #6 docs (.env.example + RUNBOOK §5) → #15 sets Vercel |
| "Users see stale data after booking" | #7/#5 (revalidatePath) → #20 if suspicious |
| "Write launch screenshots/user guide" | #6 vs #25: repo docs = #6, user-facing = #25 → #16 verifies |

*This file changes only with an Orchestrator-approved PR that includes a corresponding update in docs/ARCHITECTURE.md if structure/gates moved.*
