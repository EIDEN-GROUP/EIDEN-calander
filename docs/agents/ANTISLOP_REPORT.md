# ANTISLOP: CALENDAR. copy & docs sweep

**Date:** 2026-11-16 · **Agent:** ANTISLOP (this session) · **Branch:** main
**Mode:** antislop active: during (session override; the orchestrator brief is the explicit instruction; no `~/.config/antislop/settings.json` exists). Not UI work: text-only edits to copy, docs and comments.
**Verification:** `npx tsc --noEmit` clean · all 3,372 message strings (1,686 × 2 locales) parse as valid ICU (`@formatjs/icu-messageformat-parser`) · EN/FR key parity 1,686 ≡ 1,686 (unchanged) · no build run (not permitted) · production `:3000` untouched.

No git commands were used. No dependencies were added. No logic, component structure, styling or motion was changed. No files outside the copy/docs/comments lane were edited (see "Off-limits" and "Handed to other lanes").

## Headline numbers

| Category | Count | Where |
|---|---|---|
| User-visible strings rewritten (dev-jargon / dishonest / fabricated specifics) | **58** (29 keys × EN/FR) | `messages/en.json`, `messages/fr.json` |
| Buzzword verbs removed | **2** | `settings.howFormationType` ("unlocks"/"débloque") EN+FR |
| Straight apostrophes → typographic `’` | **254** (25 EN, 229 FR) | `messages/en.json`, `messages/fr.json` (P2-5) |
| Em dashes removed from comments (→ colon/comma/merged sentence) | **19** | code files, see per-file list |
| Decorative banner separators removed | **4** | `components/keyboard/registry.ts` (3), `scripts/create-admin.mjs` (1) |
| Duplicated comment line removed | **1** | `components/charts/csv.ts` |
| Broken comment fragment merged | **1** | `lib/notifications.ts` |
| Em dashes removed from SQL comments (comment lines only) | **42** | `supabase/migrations/0001…0008` |
| Em dashes removed from other-agents' working docs | **183** | `docs/agents/ORCHESTRATION.md` (50), `IMPECCABLE_FINDINGS.md` (70), `DESIGN_FIX_REPORT.md` (63) |
| Em dashes removed from env template comments | **14** | `.env.example` |
| Factual/honesty corrections in docs (fabricated controls & claims) | **~60**, itemized below | `docs/*.md`, `README.md`, `.env.example` |
| New files | **1** | `docs/agents/ANTISLOP_REPORT.md` (this file) |

Em dashes remaining in product copy and messages: **0**. Em dashes remaining elsewhere in the repo are all intentional, quoted UI text, or off-limits (see below); this report quotes some of them.

---

## 1. Messages (`messages/en.json`, `messages/fr.json`)

Notable: the sweep found **zero** classic buzzword-piled marketing prose in the files; the previous pass (em-dash purge) is visible in them and I kept it. The real problems were (a) dev-mode scaffolding shown in live mode, (b) fabricated specifics presented as fact, (c) a placeholder promising unbuilt features.

### 1a. Dev-mode leakage in user copy shown in both modes (20 strings)
`formations.createModalDescription` ("everything stays in this demo until the backend is wired" → "Capacity, waitlist and attendance are tracked on the booking.") · `clients.createDescription` ("once wired") · `formations.savedLocallyNote` ("until wired to the bookings engine" → "In preview mode, entries stay on this device.") · `clients.newBookingDemo`, `clients.addToFormationDemo`, `clients.toastAddToFormationDemo`, `requests.approvedTitle`, `requests.declinedTitle`, `requests.cancelledTitle`, `settings.utilizationAria` (all dropped the `(demo)` dev suffix; `toastAddToFormationDemo` now honestly points at Formations: "Enroll {name} from the Formations page").

### 1b. Fabricated specifics presented as fact (12 strings)
`requests.approvedBody` ("ONCF: Steering committee now sits at… Confirmation emails went to yasmine@casatech.ma and events@oncf.ma." → "The booking now sits at <strong>{slot}</strong> · {room}.") · `requests.declinedBody` ("…{room} at 14:00. Yasmine B. was notified" → "The incumbent keeps {room}") · `requests.cancelledBody` ("ONCF keeps {room} at 14:00" → "The incumbent keeps {room}") · `calendar.titlePlaceholder`, `requests.declineReasonPlaceholder`, `settings.digestChangeRequestsSample` (ONCF demo-company references → neutral "Steering committee"; kept the labelled *sample* context where it was genuinely a sample).

### 1c. Dishonest feature-claim copy (14 strings)
`formations.cancelSessionDescription` ("participants would be notified by email": no participant mailer exists; claiming it in live mode is false. Now: "The booking is released. No email is sent to participants.") · `formations.removeParticipantBody` ("Demo only: nothing is sent." → "No email is sent.") · `settings.tabSecurityDesc` + `settings.tabDescSecurity` ("MFA, active device list", "MFA enrollment": **unbuilt**; the tab is a phase placeholder. Now points to `/profile`) · `common.landsInPhase` ("Lands in Phase 4": internal jargon shown to all staff; now "Coming soon" / "Bientôt disponible") · `requests.announceApproved`, `requests.announceDeclined` ("Both parties were notified": unverifiable in demo mode, overclaiming in live; dropped the claim, kept the fact).

### 1d. Buzzword (2 strings)
`settings.howFormationType`: "unlocks"/"débloque" → "enables"/"active".

### 1e. Internal jargon in user copy (4 strings)
`calendar.dragHint` ("enforced by database trigger" / "déclencheur de base de données": IMPECCABLE P2-3's named example) · `settings.whatsappSmsNote` ("same triggers"/"mêmes déclencheurs").

### 1f. Demo-dataset overclaim (6 strings)
`formations.notFoundBody`, `clients.notFoundBody`, `plans.notFoundBody` ("in the demo dataset": shown in live mode too; now mode-agnostic: "…It may have been removed or created in another tab.").

### 1g. Typography (254 strings touched, 1 per occurrence)
Straight `'` → `’` in every message value, both locales (ICU-safe: no apostrophes precede ICU syntax chars; verified zero `''`). Fixes IMPECCABLE P2-5 (fr.json was 233 straight : 17 curly; now 0 straight).

EN/FR parity preserved everywhere; placeholder variables verified unchanged via strict ICU parse of all strings. Register parity kept (FR stays crisp, no inflation).

---

## 2. Code comments (why-kept, narration-cut)

Em dashes → colon in comments (19 total):
- `components/keyboard/KeyboardManager.tsx` ×4 · `ShortcutsCheatsheet.tsx` ×3 · `registry.ts` ×2 · `CommandPalette.tsx` ×2
- `components/calendar/CalendarClient.tsx` ×2 · `components/shell/TopBar.tsx` ×1 · `components/formations/Modal.tsx` ×1
- `app/actions/sign-out.ts` ×2 · `app/(public)/forgot-password/page.tsx` ×1 · `app/(public)/reset-password/page.tsx` ×1

Decorative separators: `registry.ts` had three `/* ---------- */` banner pairs around section labels; collapsed to single plain lines (`/* Commands (palette entries) */`, `/* Fuzzy match: … */`, `/* Documented shortcuts … */`). `scripts/create-admin.mjs`: dropped the `* ====…` header rule.

Other: `components/charts/csv.ts`: removed the duplicated file-header sentence (an AI-doubled line). `lib/notifications.ts`: merged a broken two-line fragment into one sentence.

No narration-style comments ("increment counter", "handle the result", "step 1/2/3") were found in an additional regex sweep. `TODO(WIRE)` markers that name concrete tasks were kept (they are specific and still true: reply rate-limit edge enforcement, bulk-participant dedup) and are now also documented in `docs/ACTIONS.md`.

## 3. SQL migrations (comments only: no SQL touched)

42 em dashes in `--` comment lines across `0001_extensions_enums.sql` (1), `0002_tables.sql` (15), `0003_indexes_triggers.sql` (4), `0004_functions.sql` (8), `0005_rls.sql` (6: four mid-line, two end-of-line), `0006_booking_status_paused.sql` (1), `0007_log_audit_event.sql` (3), `0008_notification_prefs_locale_brand.sql` (4).
**Deliberately not touched:** `0006_booking_status_paused.sql:11`: `COMMENT ON` string literal stored in the database; editing it would alter an applied migration's stored text. Also kept the `-- ====` section banner style in migrations (a deliberate house style for a long file; not AI noise).

## 4. Docs

### 4a. Honesty corrections (fabricated controls/claims removed): by file

**`docs/SECURITY.md`** (~22 items). Threat-model rows: login 5→15 lockout removed (no lockout exists in app code), CSRF reworded to framework-level enforcement, export-exfil row rewritten (no `/api/export/*` exists), supply-chain row rewritten (npm audit non-blocking, no Dependabot), shared-office row rewritten (no idle timeout), contact@ → mailbox, XSS row contact@ → makrich. Non-goals: false "CSP allows unsafe-inline, scripts locked to 'self'" claim replaced with the truth (no CSP, no HSTS; deferred for nonce reasons); idle-timeout non-goal corrected. §2.1: "no public forgot-password endpoint" → documents the real `/forgot-password` flow (identical response, 1 h, single-use, others-sessions revoked); temp-password channel claim corrected (emailed via welcome mail; bootstrap script prints stdout only); password policy corrected (10 chars, letters+numbers, custom meter, no zxcvbn). §2.2: `is_admin()` description corrected (`is_active` included); storage bucket now "brand-assets". §2.3: removed the invented 25/30-min idle timeout; documented real behavior (`proxy.ts` `is_active` gate, ban, `scope:"others"` on own password change). §2.4: removed the fictional app-level `Origin`/`Sec-Fetch-Site` middleware. §2.5: table replaced with reality (in-memory per-instance 30/10 min reply limiter; cron bearer; Supabase-side auth throttling). §2.6: headers list replaced with the actual five headers; iframe sandbox value corrected (`allow-same-origin`, no `allow-scripts`). §2.7 items 4, 5, 6, 8, 9 rewritten to the code's real behavior (images-toggle not audited, no magic-byte sniffing: force-download only, no 1 MB .eml cap, body fetched on demand). §2.8 rewritten: real bucket name, no server-side size/MIME enforcement, **SVG is not sanitized** (flagged), client-side filename caveat, admin-write-only boundary. §3: `audit_log` real columns (no `actor_role`/`result`/`user_agent`); "events wired today" vs "not wired" split made explicit (31 wired, 15 not). §6 P1/P2: contact@ → `makrich@…`/`security@…`; "global session revoke" → dashboard revocation. §7: npm audit non-blocking; Dependabot not configured. §8: pen-test items corrected to the real controls. Cross-refs §9→§8, §7→§6 fixed. §2.5's schema/SQL refs to nonexistent `login_attempts` removed.

**`docs/ARCHITECTURE.md`** (~17 items). `lib/db/*` → actual typed loaders (`lib/live-data.ts` etc.); route handlers list corrected (no `/api/export/*`; real `/api/mail/*` inventory); Server Actions path `lib/actions` → `app/actions`; login flow rewritten (no lockout, no login audit, proxy enforcement); conflict-flow statuses `active`→`confirmed`/`pending_conflict`; inbox flow rewritten to the real route-handler flow (no server-side cache/throttle; `sandbox="allow-same-origin"`; no mail audit); module map: all key-action names corrected to real exports; route groups `(staff)/(admin)` → `(app)/(public)`; "current state: v0 scaffold" note → tree kept in sync; folder tree corrected (no `components/ui/`, no `tests/`, real `e2e/`, `app/actions/`, `app/api/mail/*`); §10 CI corrected (unit/e2e NOT in CI; audit non-blocking; types-drift not automated); `week_grid` RPC removed (never existed: calendar loads via `lib/live-data.ts`); bundle budget and LCP claims reworded from "enforced" to "aspirational, not measured"; Recharts loading description corrected (not `next/dynamic`); service-role module path corrected (`service.ts`, plus noted it lacks `import 'server-only'`); `components/ui/` deleted from tree; contact@ → makrich.

**`docs/AGENTS.md`** (7 items). "Current state: create-next-app scaffold" → the app is built and lives at the prod URL; project tree (route groups, `app/actions/`, colocated unit tests, no `lib/db/`); testing-gates footer (CI enforces typecheck/lint/build/i18n parity only); role paths `lib/db|lib/actions|components/ui` → real paths (roles 4, 5, 7, 10, 11); `lib/supabase/admin.ts` → `service.ts`; `week_grid` mentions (2) removed/genericised.

**`docs/DATABASE.md`** (7 items). Migration set `0001→0005` → `0001→0008` (file table gained the 0006–0008 rows; `psql` block extended); "add a new `0006_*.sql`" → `0009_*.sql`; `bookings` status list gained `paused`; guard exemption corrected (all non-confirmed statuses exempt); `gen types` output path corrected (`lib/supabase/database.types.ts`).

**`docs/RUNBOOK.md`** (6 items). §9.1 rewritten: no app lockout exists; no `login_attempts` table/`locked_until` column exists; recovery = Supabase dashboard / Settings → Team deactivate+reactivate / bootstrap script limits. §6 bootstrap: subsequent users get temp password emailed (not "same way" channel-separation). §10 audit-anomaly row now points at real, queryable actions. §11 agents' "Settings → Users" / `/settings/users` → `/settings/team`, and room/category deletion claim corrected (no delete exists).

**`docs/ACTIONS.md`** (2 items). "Demo-mode wiring status / Wiring order (next session)" was stale: rewrote as "done, kept for history" with the honest residual (Realtime never wired; bell counts at load; three `TODO(WIRE)`s listed and scoped).

**`README.md`** (1 item). Screenshot note no longer claims "the UI is under active construction"; points at `audit/` as internal captures and `docs/assets/` for the planned clean shot.

**`docs/USER_MANUAL.md`** (3 items). "+ New booking in the top bar" → command palette (⌘K/⌘N) (TopBar has no such button); Security tab description corrected (placeholder; password lives on `/profile`); "Settings → Team & Users" → "Settings → Team".

**`.env.example`** (doc lane per role #6). Service-role comment pointed at `lib/supabase/admin.ts` → `service.ts` (+ "create/unlock/reset" → real operations); 14 comment-line em dashes purged.

**`docs/LAUNCH_CHECKLIST.md`, `docs/BRAND.md`**: reviewed, no edits needed (BRAND.md is clean; CHECKLIST is an accurate historical artifact).

**`docs/ARCHITECTURE.md`, `docs/SECURITY.md`** contain additional small voice fixes; no meaning changed where I edited only punctuation.

### 4b. Other agents' working documents (`docs/agents/`): purged, not rewritten
Em dashes mechanical purge (space-emdash-space → colon-space): `ORCHESTRATION.md` 50, `IMPECCABLE_FINDINGS.md` 70, `DESIGN_FIX_REPORT.md` 63 (183 total). Five **verbatim quotes of shipped UI text** were restored to their original em dashes (the login-artwork caption, "Séance actuelle — MacBook Pro", "EN — Anglais / FR — Français", and the plain-glyph `"—"` quotes); one table cell that had been `—` (meaning "n/a") now reads `n/a`.

---

## 5. Kept deliberately (not slop)

- **`—` as an empty-cell glyph** in tables/fallbacks (`{p.email ?? "—"}` etc., ~30 occurrences): a data-table convention, not prose; reads correctly in FR/EN; changing it to words would add noise.
- **Demo labels** (`demoMode`, `demoBanner`, `roomsSavedDemo`, `replySentDemo`…): shown **only** when Supabase is unconfigured: honest mode disclosure.
- **`requests.demoFallback`** ("…showing the ONCF change request"): demo-mode-only string.
- **`supabase/migrations/*.sql` `-- ====` banner style**: deliberate migration-file house style.
- **En dashes in ranges** (`08:00–19:00`, `Mon–Sat`, `2026–11`): correct typography.
- **`docs/agents/*.md` content**: peer agents' working records; punctuation-only changes, zero rewrite of findings (D-numbers, evidence, commands untouched).
- **Em dashes inside quoted shipped UI strings** (see 4b).
- **`AGENTS.md` (repo root)**: machine-re-rendered by `next dev`; its 2 em dashes will return if removed.
- **"Warm it" phrasings like "numbers your accountant will love"** (`reports.subtitle`): dry, human voice; kept.
- **`plans.demoTimelineNote`** ("live activity lands with the backend"): left **unedited**: see below (paired with an out-of-scope hardcoded fabrication).

## 6. Handed to other lanes / flagged (NOT edited by me)

1. **`components/plans/PlanDetail.tsx`** hardcodes a fabricated activity timeline: invented people ("Yasmine", "Marouane", "Karim", "Demo Admin") and fake events ("Yasmine completed 'Acoustic panels' · today · 09:12") rendered in **both** live and demo modes, with EN-only strings inside the FR UI (violates EN/FR parity too). R-18/R-38 matter this. This is JSX: out of my lane. Pairs with `plans.demoTimelineNote`; owning agent or UI/UX+DISPLAY should remove the fake timeline or make it real.
2. **Login lane files** (`app/(public)/login/**`, `components/auth/**`): 12 remaining comment em dashes: login agent owns; flagged. Their in-product artwork strings (e.g. `React Avancé — Session 3`, aria-hidden French) were already flagged by the orchestrator as an i18n violation; I did not touch them.
3. **`app/globals.css`**: 11 remaining em dashes: motion agent owns.
4. **`components/bookings/BookingDrawer.tsx:721`**: hardcoded English `aria-label="Quick actions"`: i18n lane (needs a key in both locales).
5. **`lib/supabase/service.ts`**: has no `import 'server-only'` (convention only). One-line add; not a text edit, so flagged not done.
6. **SVG logo upload** is not sanitized (`app/` GeneralView → bucket `brand-assets`, public read). RLS admin-gate is the only boundary. Security/DESIGN FIX lane; documented in `docs/SECURITY.md` §2.8.
7. **Empty-cell "—" glyph** kept (see above); if the brand wants words ("—" → ""), UI/UX lane should decide.
8. **Demo fixtures in code** (`TeamView.tsx` demo users, `AuditView.tsx` demo actors, `DashboardView.tsx` `firstName: "Marouane"`, `ClientDetailClient.tsx` fake timeline notes, `fallback-fixtures.ts`): reachable only in demo/unconfigured mode; out of copy scope but see #1 for the one that is not.
9. **Login hardcoded French artwork strings**: see #2.

## 7. Wanted to change but unsure (quoted)

- `reports.subtitle`: **"Rooms, revenue and formations: numbers your accountant will love"**: kept; I read it as the product's dry voice. If it reads too cute to the team, the safe edit is "Rooms, revenue and formations".
- `requests.demoFallback`: **"No request “{id}” in demo data: showing the ONCF change request."**: kept: it is demo-mode-only and discloses the substitution honestly.
- `settings.digestThisWeekSample`: **"Salle Grande ×4 · Salle Formation ×2 · Salle Petite ×3: grouped per room"** (and `digestFormationsFillingSample` "React Avancé: Session 4 · 19/20 seats · 1 on the waitlist", `digestUtilizationSample` "Casablanca 71% · Agadir 38%"): kept: the whole weekly-digest block is explicitly labelled "Planned, not built yet… Preview below is the working draft", so these are labelled sample data, not fabricated claims. If the team prefers neutral sample rows, easy follow-up.
- `settings.erasureRequestNote`: **"A signed erasure request must arrive at makrich@eiden-group.com before any real anonymization happens."**: left as-is; see contradiction note below.
- `firstLoginNote` / `avatarComingSoon` ("your initials work great for now"): kept: human register, honest placeholder disclosure.
- EmptyState `landsInPhase` call sites still pass `{ phase }` (unused arg, harmless). Left untouched because removing it would edit JSX.

## 8. Needs a human decision (fact I cannot adjudicate)

**The mailbox address is documented two incompatible ways in this repo:**
- `.env.example` + the live UI captures in `.playwright-mcp/` (2026-11-16 10:44–11:13) render **`contact@eiden-group.com`** (and `.env.example` uses it for `SMTP_USER`/`EMAIL_FROM`/`IMAP_USER`/`MAILBOX_ALLOWED`).
- `README.md`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/USER_MANUAL.md`, `docs/LAUNCH_CHECKLIST.md` and `en.json` (`settings.erasureRequestNote`) all say **`makrich@eiden-group.com`**.

I kept the doc corpus on `makrich@…` (6+ files vs one template) and changed nothing in `.env.example` except its stale service-role comment. **Confirm which is the production mailbox**, then sweep one side to match. Related: `.env.example` says `SMTP_USER=contact@…`, so a fresh setup copied today wires the public contact mailbox into the inbox; that may or may not be intended.

Second adjudication: **`docs/agents/DESIGN_FIX_REPORT.md`** was discovered mid-sweep (appeared 13:59 while I worked); I purged its em dashes mechanically and left its content alone. If other agents are editing it concurrently, expect punctuation noise in the next diff.

## 9. Verification

- `npx tsc --noEmit` → clean (exit 0) after all edits.
- EN/FR key parity: 1,686 ≡ 1,686 (unchanged by this sweep).
- All strings (EN and FR) parse as valid ICU MessageFormat.
- No straight apostrophes remain in `messages/fr.json` (0) or `en.json` (0).
- No `TODO(WIRE)` added; none removed.
- No new deps, routes, migrations, env or config changes (one comment-only fix + punctuation in `.env.example`; no functional change).
- `:3000` was never touched; no `next build` was run; no DB writes.
- Login files and `globals.css`: **zero lines edited**.

## 10. Honest limits

- FR register was matched to the surrounding strings where I rewrote them, and constructs were kept simple (no subjunctive gymnastics). They are valid French, but a native-speaker pass on the 29 rewritten FR strings would be cheap insurance.
- Docs now match the repo as it exists **today** (16 Nov 2026); anything I could not verify from the tree (e.g. Vercel project settings, DNS, actual Supabase dashboard) I either left as written or flagged.
- The biggest false claims I found and fixed were in `docs/SECURITY.md` (invented lockout, CSP, rate limits, audit events) and `docs/ARCHITECTURE.md` (`week_grid`, `components/ui/`, `/api/export/*`); both are now faithful to the code. Some residual aspiration remains (clearly labelled, per file).
