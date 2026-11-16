# IMPECCABLE: CALENDAR. Design Audit

**Date:** 2026-11-16 · **Build audited:** production at `http://localhost:3000` (Next 16.4.6, React 19.3.0) · **Locales:** EN + FR · **Viewports:** 1440px (authenticated pass), plus code-verified for 1024/768/375
**Brand:** Canvas `#F5F5F7` · Surface `#FFFFFF` · Obsidian `#1D1D1F` · Obsidian Light `#424245` · Electric Blue `#0066CC`: "Architecture for Time." Light-only by design; never dark chrome.

**Scope caveat: read this first.** Around 13:00 the shared browser context this audit runs in left the authenticated app (it briefly landed on a *different local instance* at `localhost:3100`, an unrelated dev build with a geometric login artwork: **do not confuse the two**), and the default context returned to `localhost:3000` **signed out**. I did not re-authenticate (no credentials available, and none should be used). Consequences for coverage:

- Fully verified live (FR, 1440px, full-page screenshots): `/dashboard`, `/calendar` (week/day/month/agenda), `/formations`, `/clients`, `/plans`, `/reports`, `/inbox`, `/notifications`, `/requests`, `/profile`, `/settings` hub, `/settings/{general,rooms,categories,team,working-hours,notifications,localization,audit,data,mail,security}`, plus `EN` of `/dashboard`, and `EN` `/login`, `/forgot-password`, `/reset-password`.
- **Not live-verified:** all `[id]` detail routes (`/formations/[id]`, `/clients/[id]`, `/plans/[id]`, `/inbox/[id]`, `/requests/[id]`), FR public pages, EN versions of content pages, and all responsive widths. The DB is empty anyway (0 formations, 0 clients, 0 requests), so `[id]` routes would render empty/not-found states. Findings on those surfaces are **code-derived** and marked `(code)`.
- **The tree is being edited live.** `app/globals.css` grew from 242 → 400 lines during the audit (mtime 13:01, added `--color-error-fg`, motion tokens, `:focus-visible` ring animation) and `TopBar.tsx` gained a command palette after I first screenshotted it. Line numbers are as read at audit time; expect drift.

**Counts:** **P0: 2 · P1: 12 · P2: 14** (plus a limitations note). Screenshots referenced inline live in `audit/*.png`.

---

## TOP 10 WINS (highest leverage, ordered)

1. **Kill the two sub-AA contrast failures on the reset-password screen** (12px `text-success`/`text-warning` on white at ~2.1–2.2:1). One class change buys full AA. `P0-1`
2. **Fix Success/Warning icon glyphs on tint circles** (`MailCheck`, `CheckCircle2`, `KeyRound` at ~1.8–2.0:1). Use the existing `tint-fg-green`/`tint-fg-amber` pairing. `P0-2`
3. **Categories table overflow at 1440px**: measured 860px table inside an 834px wrapper; the `ACTIONS` column (pencil + header) is half-clipped at the most common desktop width. Drop `min-w-[860px]` → `min-w-0`, and stop the system chip wrapping to 3 lines. `P1-1`
4. **One page-title token.** Today: 22 / 24 / 26 / 28 / 28→32px across routes. Standardize on `text-[28px] font-extrabold tracking-[-0.05em]` (the dominant pattern) or a `--text-h1` design token. `P1-5`
5. **One container philosophy.** Most pages are fluid; notifications/requests are `max-w-3xl` centered; the settings hub is `max-w-5xl`; detail pages are `max-w-[1440px]`. Pick fluid-with-`max-w-[1440px]` everywhere (detail pages already do it) or document the centered variant for truly narrow views. `P1-6`
6. **Placeholder text is 2.11:1** (`placeholder:text-black/30` in `.input`/`.input-pill`). Raise to `black/50` (≈4.2:1): every input in the product gets more legible for free. `P1-8`
7. **Register the ⌘K handler or delete the kbd hint**: until recently the top search was a dead control with a fake shortcut badge; a parallel edit introduced a palette (good). Verify it works in production and that the button still degrades gracefully. `P1-12`
8. **Pluralize counters**: FR renders "1 utilisateurs · 1 actifs" (EN "1 users · 1 active") in the Team tab. Add `one/other` message keys. `P1-9`
9. **Remove internal jargon from user-visible copy**: "appliquée par un déclencheur de base de données", "docs/RUNBOOK.md", environment-variable talk. End users should never read "database trigger". `P2-3`
10. **Consolidate the three toast implementations** (settings: bottom-right/4s; formations/bookings: bottom-center/4.5s; formations error icon tinted amber). One queue, one position, correct semantic icon. `P1-11`

---

## P0: broken layout · unreadable contrast · a11y failure

### P0-1 · Password-strength hint fails WCAG AA at body size
- **File:** `components/auth/ResetPasswordClient.tsx:155`
- **What:** `text-[12px] font-semibold` helper under the new-password field uses `text-success` (`#34C759`) or `text-warning` (`#FF9F0A`). Measured on white: **2.22:1** and **2.06:1** (AA body text requires 4.5:1). The string it renders is instructional UI text, not decoration: "Mot de passe assez fort" / "Encore quelques caractères…" (EN: "Password strong enough" / "A little longer…").
- **Why:** Below AA floor → legally/comparably unreadable for low-vision users; also inconsistent with the app's own `text-error-fg` discipline (`#B02A1F`, 6.6:1).
- **Fix:** use the existing foreground tints: `strongEnough ? "text-tint-fg-green" : "text-tint-fg-amber"` (`#1E6B31` 6.6:1, `#A34D00` 5.8:1). Same pattern already used in `FormationDetailClient.tsx:692`.

### P0-2 · Success/Warning icons on tint circles fail non-text contrast (3:1)
- **Files:** `components/auth/ForgotPasswordClient.tsx:54` (`MailCheck`, `text-success` on `bg-success-tint` circle ≈ **1.98:1** on the blend), `components/auth/ResetPasswordClient.tsx:93` (`CheckCircle2`, same pair), `components/auth/ResetPasswordClient.tsx:110` (`KeyRound`, `text-warning` on `bg-warning-tint` ≈ **1.83:1**).
- **What:** 24px status icons inside 48px tinted circles on the "Check your inbox", "Password updated", and "Link expired" states: the three most-read moments of the whole recovery flow.
- **Fix:** `className="text-tint-fg-green"` / `text-tint-fg-amber` (5.2–6.6:1 on the same tints). Alternatively deepen the tint circles' ring and keep icons ≥ `#1E6B31` / `#A34D00`. This needs zero layout change.

> Borderline, filed P1 not P0: the Categories table Actions column clipped by 26px at 1440 (`P1-1`), and React hydration error #418 in production (`P1-2`).

---

## P1: weak hierarchy · cramped spacing · misalignment · inconsistent semantics

### P1-1 · Settings → Categories: table clipped inside its card at 1440px (measured)
- **Files:** `components/settings/views/CategoriesView.tsx:317–318`, `.chip` `app/globals.css:266–268`, row content at `CategoriesView.tsx:471–489` (`systemRenameOnly` chip, no `whitespace-nowrap`).
- **Evidence:** live page `/settings/categories` (screenshot `audit/22-settings-categories-1440.png`, element capture `audit/22c-categories-table-element.png`).
  `browser_evaluate` result: `tableScrollWidth=860, tableOffsetWidth=860, wrapperClientWidth=834`: the table is 26px wider than its scroll container; card's right edge (`cardRight=1018`) cuts the `ACTIONS` header mid-glyph ("ACTION" visible) and the pencil buttons are half outside the card.
- **Also:** the `Système: renommage uniquement` chip wraps as `Système: / renommage / uniquement` in a 3-line, ~64px-tall pill; it stretches the row and forces `overflow-x` scroll for 3% overflow.
- **Fix:** drop `min-w-[860px]` (set `min-w-0` / rely on `w-full`); add `whitespace-nowrap` to `.chip`; shorten the FR label if needed ("Système · renommage"); give the Actions column `position: sticky; right: 0` with a white gradient mask if the table must keep `min-w` on small screens; alternative: shrink sidebar to `280px` and reduce name-column padding. At ≤1280px the card is even narrower: recheck after fix.
- Severity note: this is the closest thing to a P0 on the desktop happy path: one screen at the primary supported width ships with visibly clipped affordances.

### P1-2 · Production console error: React hydration mismatch (#418) on /settings/audit
- **Where:** observed live at 12:58 on `/settings/audit` (`.playwright-mcp/console-2026-11-16T12-58-46-699Z.log`).
- `Minified React error #418 … args[]=text` = hydration failed because a **text node** did not match SSR output. `AuditView.tsx:113–155` formats dates/times (`Intl.DateTimeFormat(appLocaleTag())`) at module scope and inside render; anything time-sensitive (server render vs client re-render across a minute boundary, or a locale tag derived differently server/client) trips it. In production React recovers by client-rendering: i.e., a full extra render and a visible content swap on an otherwise static admin table.
- **Fix:** compute date/time strings from the same source on both sides (pass them down as props from the server component, or `suppressHydrationWarning` on the specific `<span>` at `AuditView.tsx:320–330`), and never construct `new Date()` at module scope (`AuditView.tsx:77`, `DEMO_EPOCH`) for render output.

### P1-3 · Settings → Audit: filter selects truncate their selected value mid-word
- **File:** `components/settings/views/AuditView.tsx:223,232`
- `<select id="audit-verb" class="input h-10 w-32 …">` (128px): the live FR selection renders as **"Toutes les activ"** (for "Toutes les activités"). Actor select is `w-36` (144px) with the same risk.
- **Fix:** `w-44` minimum (176px) or `field-sizing: content`; keep `text-[13px]`. Ideally both selects and the date inputs on one row use a `grid grid-cols-[…]` that scales instead of fixed widths.

### P1-4 · Formations search box clips its placeholder mid-phrase
- **File:** `components/formations/FormationsClient.tsx:293`
- `className="input h-11 w-40 pl-10 sm:w-56"`: live FR shows **"Rechercher un titre, un"** cut off ("Rechercher un titre, un formateur…"). EN placeholder ("Search a title, a…") clips the same at `w-56` (224px).
- **Fix:** `w-48 sm:w-64` (192/256px) and/or shorten the placeholder ("Rechercher un titre, un lieu…"; EN "Search title or place…"). `pl-10` + icon is correct; the label (`searchLabel`) stays as-is.

### P1-5 · Page-title type scale is inconsistent across routes
- **Where:** measured across the codebase: 22px extrabold (`ReadingPane.tsx:191` tracking `-0.02em`; `PlanDetail.tsx`, `FormationDetailClient.tsx` h1s), 24px (`components/settings/PageHeader.tsx:30`: every settings tab), 26px (`components/EmptyState.tsx:6`: the `/settings/security` phase-4 screen, auth cards `ForgotPasswordClient.tsx`), 28px fixed (`(app)/notifications/page.tsx:69`, `(app)/requests/page.tsx:155`, `(app)/settings/page.tsx:45`, `app/not-found.tsx`), 28→32px responsive (`DashboardView`, `CalendarClient`, `FormationsClient`, `ClientsClient`, `PlansBoard`, `ReportsView`: `sm:text-[32px]`), inbox 28px leading-none, KPI numerals 26px mono vs dashboard 26px sans.
- **Why:** no shared H1 token; nine routes, five sizes, three trackings (`-0.02/-0.04/-0.05em`). Hierarchy across the app is "similar but never identical": exactly what a design review should catch.
- **Fix:** introduce one token, e.g. `.h1-page { font-size: 28px; font-weight: 800; letter-spacing: -0.05em; line-height: 1.15; }` (28px matches the majority and reads architecturally): or `text-[32px]` everywhere and drop 24/26; either is fine, do it once. Reading-pane titles may stay 22px as a deliberate sub-article size.

### P1-6 · Page container philosophy is inconsistent (three gutters)
- Fluid full-width (most routes) vs centered `mx-auto max-w-3xl` (`notifications/page.tsx:69`, `requests/page.tsx:155`) vs `mx-auto max-w-5xl` (settings hub, `settings/page.tsx:45`) vs `mx-auto max-w-[1440px]` (detail pages).
- Measured effect: on 1440px the notifications/requests/hub columns float in dead canvas (content starts at ≈374px) while every other route uses the full rail-to-edge width; settings tabs start at ≈180px.
- **Fix:** adopt `mx-auto max-w-[1440px]` for all authenticated routes (detail pages already prove the pattern): the centered variants buy nothing at ≥1280px; reserve narrow measure for reading content (inbox pane) only.

### P1-7 · Settings → Localisation: the inline `lang` code pill renders as a tall grey blob; FR line leaves an orphaned dash
- **File:** `components/settings/views/LocalizationView.tsx:223`
- The `<li className="flex gap-2">` makes bare text runs anonymous flex items; default `align-items: stretch` stretches the `<code class="rounded-sm bg-canvas px-1 font-mono text-[10px]">lang</code>` to the row's full height (~64px tall in the live capture, `audit/26b-localization-sidebar.png`), while "Site public," wraps and a lone **"—"** is orphaned on the next line in FR/EN.
- **Fix:** `items-start` on the `<li>` and `self-center` on the `<code>`; or restructure the sentence so the code token sits inline in flowing text (drop the flex row, keep icon + `<p>`).

### P1-8 · Placeholder contrast 2.11:1 everywhere
- **File:** `app/globals.css:210,217`: `.input` / `.input-pill` use `placeholder:text-black/30` (rgba(0,0,0,.3) on white = **2.11:1**). The login form (`input-pill`), settings forms, search fields: every field in the product.
- **Fix:** `placeholder:text-black/50` (≈4.1:1) or `/55` (4.76:1). Keeps the soft look, crosses the 3:1 non-text floor and nearly AA body.

### P1-9 · Pluralization broken in counters (FR and EN)
- **Files:** `components/settings/views/TeamView.tsx:275` with `messages/fr.json:1685` (`usersCountBefore: "utilisateurs ·"`) and `messages/en.json` (`"users ·"`).
- Live FR renders **"1 utilisateurs · 1 actifs"**; EN renders **"1 users · 1 active"**. Same pattern for the formations count ("0 sur 0 formation affichée" is actually fine FR singular, but inconsistent).
- **Fix:** ICU plural in the message: `"{count, plural, one {# utilisateur} other {# utilisateurs}} · {active, plural, …}"`: one-line change per string in `TeamView` and the formations footer.

### P1-10 · Two primary-CTA scales coexist; settings actions understate themselves
- Global `.btn` = `h-11 text-[15px] font-semibold px-6` (formations/clients/dashboard CTAs). Settings toolkit hardcodes `h-10 px-4 text-[13px] font-bold` at every primary action (`RoomsView.tsx:220,243`, `CategoriesView.tsx:291,311,544`, `TeamView`, `WorkingHoursView`, `DataPrivacyView.tsx:167,316`, `AuditView.tsx:266`, `MailView.tsx:108,159`).
- **Why:** identical visual grammar, two weights of emphasis; a first-time admin can't tell a page's primary action from a utility button by size. (Deliberate? Then it should be a documented `.btn-sm`, not 20 inline copies.)
- **Fix:** add `.btn-sm { @apply h-10 px-4 text-[13px] font-bold; }` and use it deliberately, or align settings to `.btn`. Pick one scale and one font-weight for primary CTAs.

### P1-11 · Three toast systems, three positions, one wrong icon tone
- `components/settings/Toast.tsx:44`: `fixed bottom-20 right-4 … sm:bottom-6 sm:right-6`, 4000ms, success-only, icon `text-success` (on obsidian: fine there).
- `components/formations/Toast.tsx`: bottom **center**, 4500ms, 3 tones; the **error** tone is tinted `text-warning` (amber = caution, not failure).
- `components/bookings/Toast.tsx`: bottom center, icon `text-success` / `text-warning` by tone.
- **Fix:** one shared viewport (bottom-right above BottomNav, `bottom-20 sm:bottom-6`, `TOAST_MS = 4000`), icons `text-success` (success), `text-error-fg`-on-obsidian → e.g. `#FF6B62`/`text-error` (error), `text-white` (info); same enter/exit animation tokens everywhere. Deletes ~3 implementations worth of drift.

### P1-12 · Keyboard bypass: no skip link; icon-only target sizes under 44px
- No skip-to-content mechanism anywhere (no `skipLink` in `app`/`components`; bypass currently relies on landmarks only: `<nav aria-label>`, `<main>`, `<header>` exist, which covers screen readers but not sighted keyboard users, who tab through the 9 rail buttons + 3 top-bar controls on *every* route).
- Tap targets: rail `h-12 w-12` (48 ✓), TopBar bell `h-11 w-11` (44 ✓), BottomNav cells (≥64 ✓): good; but categories-table reorder buttons are `p-1.5` (≈26px hit, `CategoriesView.tsx:415,425`), pencil/trash are `p-2` (≈30px), segmented control `.segment` is `h-8` (32px, calendar view switcher + top-bar locale EN/FR + formations filter tabs): all pass WCAG 2.5.8 (24px) but miss Apple's 44px HIG for repeated micro-actions.
- **Fix:** add `<a href="#main" className="sr-only focus:not-sr-only …">{t("skipToContent")}</a>` in `(app)/layout.tsx` (give `<main id="main">`); bump micro-icon buttons to `p-2.5` (≈34–36px) minimum in dense tables and prefer `h-11` for `.segment` on touch devices via `@media (pointer: coarse)`.

> Related but not a defect: `:focus-visible` double-ring (`globals.css:92–97`) is excellent: 3px canvas + 6px 45%-electric ring. However it also sets `border-radius: var(--radius-xs)` on **every** focused element, so a pill button morphs into an 8px rounded rect on focus. Remove the radius override; the shadow ring doesn't need it. (Moved to P2-4.)

### (Cross-cutting, needs verification) Inbox: skeleton list never resolved during the audit
- `/inbox` showed shimmer skeleton rows for the entire observation window; IMAP is remote and slow, but an endless skeleton with no timeout is indistinguishable from "broken". There is a `MailErrorBanner` and `MailApiError` path: verify that a >15–30s IMAP hang surfaces the banner instead of perpetual skeleton. `(code-derived: mark P1 if confirmed, else close as WAI.)  `

---

## P2: polish · refinements · nice-to-haves

- **P2-1 · `/settings/security` phase-4 page lacks the breadcrumb header** every other settings tab has (`PageHeader` breadcrumb "Paramètres › {Tab}"). It renders a bare centered `EmptyState` (`app/(app)/settings/[tab]/page.tsx` → `components/EmptyState.tsx`, `min-h-[60vh]` white card), so the only tab without a header is the phase-promise screen. Add the same breadcrumb ("Paramètres › Sécurité") for consistency. (Also confirm whether hub should keep its missing `ADMIN` badge: every other hub card carries `ADMIN`, Sécurité doesn't: `settings/page.tsx` TABS list: inconsistent semantics; either badge it or document why.)
- **P2-2 · `.chip` ships without `whitespace-nowrap`**: root cause of the 3-line system chip (`globals.css:266`). Harmless elsewhere, but nowrap by default is the correct chip behavior.
- **P2-3 · Internal jargon leaks into user-facing copy.** FR: calendar footer *"…appliquée par un déclencheur de base de données"* (`messages/fr.json:220`, EN: *"…enforced by database trigger"*); settings/mail *"…variables d'environnement Vercel…"* + *"Voir docs/RUNBOOK.md · §5"*; settings/notifications *"…les identifiants vivent dans les variables d'environnement Vercel…"*; settings/data *"…voir docs/RUNBOOK.md…"*. Admins may tolerate it; "RUNBOOK.md" in a UI string and database-trigger talk are not for every pair of eyes. Reword to outcome language ("Les doubles réservations sont bloquées automatiquement.") and move file paths to docs.
- **P2-4 · `:focus-visible` changes control geometry**: sets `border-radius: var(--radius-xs)` on all focused elements (pill → 8px rect). Drop the radius declaration; keep the animated double ring.
- **P2-5 · French typographic apostrophes.** `messages/fr.json` mixes straight `'` (218 occurrences) with curly `’` (16). French UI set in SF should use `’` consistently (and `« »` where quoting: `DataPrivacyView` already does this correctly). One sed pass.
- **P2-6 · Month view: out-of-month dates at `text-black/25`** (`MonthView.tsx:95`) ≈ **1.77:1**: deliberately muted but below any readable floor; raise to `black/35` (2.44:1) or `black/40` (2.85:1) for "clearly not this month, but visible".
- **P2-7 · Auth screens: floating-card titles truncate with ellipsis by design** (`login/page.tsx`, cards `w-[280px]`): "React Avancé — Sessio…". Widen cards to `w-[300px]` and/or `text-[13px]`; keep `truncate` as safety. Also the mobile banner (`h-40`) is nice but the glyph is 300px on a 375px canvas: verify at 375px.
- **P2-8 · Forgot/reset-password screens are visually orphaned**: lone centered card on a flat `bg-canvas` with ~55% dead space and no brand moment (the login page has the Now-Bar + blueprint grid). Add the same `blueprint-grid` backdrop or a right-column Now-Bar motif to match the sign-in family. (Live: `audit/04-forgot-1440.png`, `audit/05-reset-1440.png`.)
- **P2-9 · Login footer & form microcopy contrast**: `text-black/40` footer (**2.85:1**, `login/page.tsx:121`) and `text-black/45` "Need access?" (**3.35:1**, `login/page.tsx:103`). Raise both to `black/55` (4.76:1).
- **P2-10 · Working-hours: header pair "OUVERT HORAIRES" reads as one word; "OUVERT" column is only `w-11`** (`WorkingHoursView.tsx:152`). Widen to `w-14` or rename columns ("Activé / Heures") so the caps kicker doesn't collide with the next column in FR (6-char "OUVERT" at 11px bold + 0.08em tracking ≈ 52px > 44px).
- **P2-11 · Three H1 tracking values** (`-0.02em` reading pane / `-0.04em` auth / `-0.05em` everywhere else). Fold into P1-5's token; don't fix independently.
- **P2-12 · Team table shows "Actif" twice** in adjacent columns (`DERNIÈRE ACTIVITÉ` = "Actif", `STATUT` = green "● Actif" chip): column is redundant in its current data state; drop `DERNIÈRE ACTIVITÉ` until it carries a timestamp ("il y a 2 h").
- **P2-13 · Profile "Sécurité" card and ProfileView password form: no username field**: Chrome logs `[VERBOSE] Password forms should have (optionally hidden) username fields for accessibility` on `/profile` (console, 12:54). Add a hidden `autoComplete="username"` input or `autocomplete="email"` on the current-password field's form. Also: the inline "Séance actuelle — MacBook Pro · Casablanca" mono line is good; keep the `argon2id`/`Supabase Auth` mono footnote if you keep the transparency-by-design stance: fine for internal tool.
- **P2-14 · Reports: sparkline sits 8px from card top edge and KPI prefix `MAD` collides optically with the huge numeral**: `StatTile` right-aligns Spark at `items-start`; nudge sparkline `height` 40→36 and give the prefix row `items-baseline` gap. Also `REVENUS MAD 0`: the `MAD` prefix reads as a label for the *label*; set `prefix` on the same baseline with `align-baseline` sizing already present but reduce to `text-[12px]` and align left. Low stakes, noticeable polish.

---

## Cross-locale integrity (FR ↔ EN)

Keys are complete both ways (1,686 = 1,686, zero missing either side). In the live UI:

| Surface | FR | EN | Verdict |
|---|---|---|---|
| Page titles / headers | "Demandes de modification", headings 1–2 lines | fits | ✓ |
| Calendar chrome | "16 – 22 novembre 2026", Jour/Semaine/Mois/Agenda | Day/Week/Month/Agenda | ✓ |
| Settings toolkit | "Toutes les activ…" (**clipped**, P1-3) | fits at `w-32`? borderline | ✗ FR |
| Team counter | "1 utilisateurs · 1 actifs" (**ungrammatical**) | "1 users · 1 active" | ✗ both |
| Localization `lang` row | orphaned "—" line (P1-7) | same wrap | ✗ both |
| Formations search | placeholder clipped mid-word (P1-4) | "Search a title, a…" clipped | ✗ both |
| Profile preferences | "EN — Anglais / FR — Français" fits | fits | ✓ |
| Localisation preview cards | "1.234.560,50 MAD" (fr-MA) fits | "MAD 1,234,560.50" (en-MA) fits | ✓ |
| Toasts / chips | nowrap chips needed (P2-2) | same | ✗ latent |

No missing-message crashes; plural rules are the only structural gap. FR copy switches straight `'` (218×) vs `’` (16×): P2-5.

## Motion & micro-interaction (verified in source)
One curve `cubic-bezier(0.25, 1, 0.5, 1)`, a real duration scale (`120/180/240/320ms`), `view-enter`, `modal-in`, `toast-in/out`, `badge-pop`, `segment-in`, focus-ring draw-in, and a global `prefers-reduced-motion` zero-motion block. This is the right architecture: spring-like without theatre. Two nits: `.btn-primary:hover` scales to 1.02 **and** adds `(0, 8px, 24px, 30%-electric)` shadow on every hover (slightly heavy for calm brand), and toast exit plays on all systems inconsistently (P1-11). Keep the grid; align the systems.

## What already earns its keep (don't break)
- Weekend hatch (`repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0 6px …)`): instantly communicates closure, zero chrome noise.
- `.now-bar` rail indicator + `aria-current="page"` on the active rail item.
- Empty states all use the NowBarMark + 56px mark, consistent copy voice ("cela prend vingt secondes."): genuinely good French.
- `tint-fg-*` foreground tokens on tints (5.0–6.6:1 everywhere I measured): the palette discipline is real.
- `:focus-visible` canvas-gap double ring; `role="status"`/`aria-live="assertive"` on the login error; `aria-label` on every icon-only button I checked (categories, reorder, locale toggle).
- Settings hub: ADMIN badges, chevron hover nudge, `card-hover` lift: coherent.

## Verified contrast ledger (computed, sRGB over declared backgrounds)
| Pair | Ratio | AA (4.5) | AA-UI (3.0) |
|---|---|---|---|
| `#FFFFFF` on `#0066CC` (primary btn) | 5.57 | ✓ | ✓ |
| `#0066CC` on white (links/next/electric) | 5.57 | ✓ | ✓ |
| `#005BB5` (tint-fg-blue) on blue tint | 5.57 | ✓ | ✓ |
| `#1E6B31` / `#4B49C8` / `#A34D00` / `#B0256B` on their tints | 5.0–5.8 | ✓ | ✓ |
| `#424245` on white / canvas | 10.0 / 9.2 | ✓ | ✓ |
| `#6E6E73` on white / canvas | 5.07 / 4.66 | ✓ (tight on canvas) | ✓ |
| `#6E6E73` as nav icons/text at 13px | n/a | use with care on canvas | ✓ |
| **`#34C759` on white** | **2.22** | ✗ | ✓ (large only) |
| **`#FF9F0A` on white** | **2.06** | ✗ | ✗ |
| **`#34C759` on success-tint over white** | **1.98** | ✗ | ✗ |
| **`#FF9F0A` on warning-tint over white** | **1.83** | ✗ | ✗ |
| `#B02A1F` (error-fg) on white / error-tint | 6.6 / 5.6 | ✓ | ✓ |
| `#C22A22` (login error text) on error-tint | 4.9 | ✓ | ✓ |
| `black/30` placeholders on white | 2.11 | ✗ | ✗ |
| `black/40` footer on white | 2.85 | ✗ | ✗ (text) |
| `black/45` "Need access?" on white | 3.35 | ✗ | ✓ (large only) |
| `black/25` MonthView trailing dates | 1.77 | ✗ | ✗ |
| `#FFFFFF` on `#1D1D1F` (toasts/obsidian chips) | 16.8 | ✓ | ✓ |

## Limitations (explicit)
1. Authenticated **EN** pass covered only `/dashboard`; content pages in EN unverified visually (locales are build-complete and FR→EN diffs are small, but treat EN wraps as unverified).
2. All `[id]` detail pages unverified live: the DB is empty and the session dropped at ~13:00. Code-derived risks on those screens are noted in-line and not shipped as findings.
3. Responsive (375/768/1024) verified by code reading only (`px-4 sm:px-6 lg:px-7` gutters, wrapping toolbars, `h-16` BottomNav + `pb-24 lg:pb-10` main: the mechanics are sound); **screenshots at those widths pending re-auth**.
4. Shared-browser incident at ~13:00: tab briefly attached to a *different local instance* (`localhost:3100`) with a different login design ("Artwork controls", geometric bauhaus artwork). Not part of this app; audit deliberately ignored it. If you have another agent/session working there, coordinate before touching ports 3000/3100.
5. The tree is under concurrent edit: several findings above may already be addressed in `HEAD` (e.g., TopBar command palette). Re-run the live pass after merge; this document reflects 12:50–13:05, 16 Nov 2026.

## Evidence index (screenshots, `audit/`)
`01/02-dashboard-*` · `03-login-1440` (EN) · `04-forgot-1440` · `05-reset-1440` · `06-calendar-week` · `07-day` · `08-month` · `09-agenda` · `10-formations` · `11-clients` · `12-plans` · `13-reports` · `14-inbox` · `15-notifications` · `16-requests` · `17-profile` · `18-settings-hub` · `19-settings-general` · `20-settings-security` (phase-4 screen) · `21-settings-rooms` · `22-settings-categories` (+`22c` element capture proving the 26px overflow) · `23-settings-team` ("1 utilisateurs") · `24-settings-working-hours` · `25-settings-notifications` · `26-settings-localization` (+`26b` sidebar crop) · `27-settings-audit` (hydration #418 in console) · `28-settings-mail` · `29-settings-data` · `30-dashboard-en-1440` (EN pass) · `31` (void: intercepted by `:3100`, do not cite).
