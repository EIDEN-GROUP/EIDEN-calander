# DESIGN FIX: Report
Date: 2026-11-16 · Agent: DESIGN FIX (#3) · Scope: static visuals only: no data flow, no persistence, no motion, no i18n keys.

## IMPECCABLE findings consumed
`docs/agents/IMPECCABLE_FINDINGS.md` landed at 13:20 (after my audit was ~80% done). Its P0/P1 items were implemented or explicitly dispositioned below (see "IMPECCABLE triage"). Its P2s where in my lane were done; the rest flagged.

**Not verified live:** I was signed out at `:3000` for the entire session (no credentials used, none sought). The only rendered surface I could check was `/login` (login agent's lane: untouched) and the redirect behavior of every other route (all bounce to `/login`). All other verification is code + `tsc --noEmit` + targeted `eslint` + EN/FR parity script + computed contrast. No authenticated screenshot exists for my fixes: treat wrapping at FR and the categories/audit table fixes as **code-verified only**.

---

## SEVERITY 1: shipped fixes (brand law / WCAG AA / broken)

| # | File:line | Issue | Fix (before → after) |
|---|---|---|---|
| 1 | `components/dashboard/DashboardView.tsx:395` | `bg-gradient-to-r from-electric to-[#3d8bff]`: gradient **and** off-book hex **and** blue-as-decoration on a room-utilization bar | → `bg-electric` solid (matches plans list progress bars). IMPECCABLE D6. |
| 2 | `app/(app)/requests/page.tsx:36` | `bg-danger-tint text-tint-fg-red`: **neither class exists in `@theme`** → declined chip rendered unstyled | → `bg-error-tint text-error-fg` |
| 3 | `components/settings/views/NotificationsView.tsx:178` | `text-tint-fg-red`: same nonexistent class → test-send error rendered default-colored | → `text-error-fg` |
| 4 | `app/globals.css` (additive @theme) + 58 usages across `app/` and `components/` | `text-error #FF3B30` at 12–13px = **3.55:1 on white: fails AA body** (brand book: body-size error text needs a darkened tint foreground) | → new additive tokens `--color-error-fg: #b02a1f` (6.6:1 white / 5.6:1 on error-tint) and `--color-error-fg-hover: #8f1f16`. All 58 body-size `text-error` occurrences → `text-error-fg`. **globals.css edit needs orchestrator sign-off (D5): see lane notes.** |
| 5 | `FormationDetailClient.tsx:748,377? · ClientDetailClient.tsx:377` (danger buttons) | `hover:bg-error hover:text-white`: white on #FF3B30 = 3.55:1, and solid red = banned danger treatment | → `hover:border-error/50 hover:bg-error/20` (keeps text-error-fg) |
| 6 | `components/settings/views/CategoriesView.tsx:437` | `bg-error` solid + white text: same 3.55:1 failure on the destructive confirm button | → `border border-error/30 bg-error-tint text-error-fg hover:bg-error/20` |
| 7 | ~15 files | `text-success #34C759` = **2.22:1** and `text-warning #FF9F0A` = **2.06:1** on white / tints: fail AA body and 3:1 UI | On light surfaces → token `text-tint-fg-green` / `text-tint-fg-amber` (5.8–6.6:1). On obsidian toasts left as-is (4.75–7.8:1 there). StatTile delta: `text-success`/`text-error` → `text-tint-fg-green`/`text-error-fg`. Icons too (ConflictModal TriangleAlert, PlanDetail CircleAlert/Flag, RequestThread CalendarClock-tile/Hourglass, BookingDrawer conflict icon). |
| 8 | `components/formations/Toast.tsx:76` | Error tone icon tinted **amber** (`text-warning`): amber means caution, not failure | → `text-error` (4.75:1 on obsidian). Bookings toast left alone (its only non-success tone is a genuine warning). (IMPECCABLE P1-11, icon part.) |
| 9 | `components/clients/ClientsClient.tsx:406` · `components/settings/views/WorkingHoursView.tsx:162` | Hover fill drift vs the other tables (`hover:bg-canvas` / `/50` vs `/60` everywhere) | → `hover:bg-canvas/60`: consistent with Team/Audit/Categories/DataPrivacy tables |
| 10 | `components/settings/views/AuditView.tsx` body cells · 340,343 · `CategoriesView.tsx:319` | Audit rows `py-2.5`, clients/team `py-3`: ragged row heights across the four tables | → `py-3` (headers stay `py-2.5`, matching Team/Categories) |

## SEVERITY 2: IMPECCABLE P1s (lane-permitted)

| # | File:line | Issue | Fix |
|---|---|---|---|
| 11 | `components/settings/views/CategoriesView.tsx:319,473` | Table `min-w-[860px]` overflowed its 834px wrapper at 1440px: ACTIONS column half-clipped; system chip wrapped to 3 lines | → `min-w-0`; chip gets `whitespace-nowrap` (globals.css `.chip` nowrap = DSE request, see lane notes). (IMPECCABLE P1-1) |
| 12 | `components/settings/views/AuditView.tsx:223,230` | Filter selects `w-32`/`w-36` truncated the FR label mid-word ("Toutes les activ…") | → `w-44` both. (P1-3) |
| 13 | `components/formations/FormationsClient.tsx:293` | Search input `w-40 sm:w-56` clipped FR placeholder mid-phrase | → `w-48 sm:w-64`. (P1-4) |
| 14 | All page-level h1s | Nine h1 sizes/trackings: 22/24/26/28/28→32px, `-0.02/-0.04/-0.05em` | → dominated pattern `text-[28px] font-extrabold tracking-[-0.05em]` everywhere it's a page h1 (EmptyState 26→28, PageHeader 24→28, Settings audit gate 22→28, FormationDetail 22/24→28, ClientDetail 22/24→28, PlanDetail 22/27→28/32, RequestThread 24/28→28/32). ReadingPane 22px kept: IMPECCABLE explicitly sanctions it as sub-article. (P1-5) |
| 15 | `notifications/page.tsx:69` · `requests/page.tsx:155` · `settings/audit/page.tsx:104` · `settings/page.tsx:45` | `max-w-3xl`/`max-w-5xl` centered columns floating in dead canvas vs fluid pages | → `mx-auto max-w-[1440px]` everywhere. (P1-6) |
| 16 | `components/settings/views/LocalizationView.tsx:223` | Bare text + `<code>` as flex items stretched the pill to ~64px tall; FR orphaned a dash | → `items-start` on the row, sentence wrapped in a `<span>` so the code pill flows inline. (P1-7) |
| 17 | 6 inline-input occurrences with hardcoded `placeholder:text-black/30` (`CalendarClient`, `InboxView`, `ReplyBox`) | Inline 2.11:1 placeholders | → `placeholder:text-black/50` (≈4.1:1). The base `.input`/`.input-pill` definitions in globals.css still carry `black/30`: **globals.css change requested from owner (DSE), see lane notes.** (IMPECCABLE P1-8) |
| 18 | `app/(app)/layout.tsx` | No skip-to-content; sighted keyboard users tab through 9 rail buttons + 3 top-bar controls every route | → `<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-pill focus:bg-obsidian focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white">{t("skipToContent")}</a>` (existing `shell.skipToContent` key: EN/FR parity already present); `<main id="main" tabIndex={-1} focus:shadow-none focus-visible:shadow-none>`. (P1-12) |
| 19 | `components/settings/views/CategoriesView.tsx:415,424,448–492` | Micro-icon buttons at `p-1.5` (26px) / `p-2` (30px): miss even the 24px-with-concerns bar for repeated table actions | → `p-2.5` throughout (≈34–36px). (P1-12, partial) |
| 20 | `components/charts/StatTile.tsx:55` | KPI `MAD` prefix optically collides with numeral; read as a label for the label | → prefix `text-[13px]` → `text-[12px]` (align-baseline retained). (P2-14, partial) |

## SEVERITY 3: brand-compliance sweep (own audit)

| # | Area | Before → After |
|---|---|---|
| 21 | Wordmark-reserved `tracking-[-0.04em]` used on **all** page headings app-wide (19 files) | → `tracking-[-0.05em]` (Title token). Wordmark itself kept at −0.04em (`components/brand/NowBar.tsx`). Incident: first sweep (badly-scoped regex) also converted `app/(public)/login/page.tsx:202` (−0.04→−0.05): **reverted** to −0.04em after discovery; login diff = zero. |
| 22 | Positive tracking `0.05–0.2em` on caps micro-labels (~66 occurrences incl. `0.18em`/`0.2em`) | → `tracking-[0.08em]` (Label token): all matches, verified zero remaining outside 13:00-added motion-agent files. |
| 23 | `tracking-[-0.03em]` on 20–28px headings & 22 px display numerals (17 occurrences) | → `tracking-[-0.05em]` (Title). On 19px empty-state/menu headings → `tracking-[-0.02em]` (Tight). |
| 24 | `tracking-[-0.01em]` on 11 small bold subheads | → `tracking-[-0.02em]` (Tight token). |
| 25 | `strokeWidth` drift: 2.5/2.6/3/3.2/3.4 → `2.4`; 1.5/1.6/1.75 → `1.8` (≈160 edits) | All icon strokes now within brand 1.8–2.4 (32 = brand arc). BottomNav `{active ? 2.1 : 1.7}` → `{active ? 2.2 : 1.8}`. |
| 26 | Sub-scale type: `text-[10.5px]` (8), `text-[10px]` (120), `text-[9px]` (11), `text-[8px]` (3), `text-[13.5px]`/`text-[12.5px]`/`text-[11.5px]` (5) | → `10.5/10 → 11px`, `9 → 10px`, `8 → 10px`, `13.5→13`, `12.5→12`, `11.5→12`. Floor is now 10px (dense-grid glyphs/badges); micro labels 11px. 11 remaining `text-[10px]` deliberately dense (kbd-adjacent, axis, mono hour marks). |
| 27 | `rounded-[6px]` (event pills, checkboxes), `rounded-[4px]` (legend swatches), `rounded-[10px]` (reply-box inputs) | → `rounded-xs` / `rounded-xs` / `rounded-sm`. No off-family radii remain outside brand-spec values (inputs 14px, segmented 9/7px). |
| 28 | Hardcoded AA-pass hexes in components (`#a34d00`, `#A34D00`, `#1E6B31`, `#B02A1F`, `#c22a22`, `#005BB5`, `#8F1F16`) | → `text-tint-fg-amber` / `text-tint-fg-green` / `text-error-fg` / `text-electric-hover` / `text-error-fg-hover`. Zero raw hex remain in `app/`+`components/` except: brand SVG marks (NowBar sanctioned), category-preset solid hues matching `@theme` presets (calendar dots/rings), `ReadingPane` email-content CSS (not app chrome), `app/layout.tsx` `themeColor: #F5F5F7` (brand canvas, metadata). |
| 29 | Money rendering: regular spaces (`MAD 1 200`, `${price} MAD`) could wrap mid-amount; FR group separator a raw space | → `formatMAD`/`formatMad` use `\u00A0`/`\u202F`; inline `MAD {formatMoney}` → existing fmtMAD token path; `BookingDrawer` price `→ MAD` nbsp; tooltips nbsp. |
| 30 | `tabular-nums` missing on rates/counts | Added: `ClientDetailClient` sample price, `RoomsView` rate input. (Counts/times already tabular.) |
| 31 | Audit table empty-card `p-3`; Dashboard warning callout `p-3` | → `p-4 sm:p-5` / `p-4` (16px inner-padding floor). |
| 32 | WorkingHours error line `pl-[118px] sm:pl-[166px]` | → `sm:pl-[162px]` (150px col + 12px gap: the 166px was 4px off, error text no longer overhangs the toggle). |
| 33 | Decorative icons missing `aria-hidden` | Added on: ClientDetailClient `ShieldCheck` (hero, near label), MessageListRow `Mail`/`MailOpen`, RequestThread `CalendarClock`, `Check` (11px done-dot). Plus `role="img"` on the notifications unread dot (aria-label was on a roleless span). |
| 34 | 36 truncated text elements without `title=` (names, subjects, emails, filenames, company, times) | → `title={…}` added: FR overflow now discoverable on hover. |
| 35 | `MoonView` trailing dates `text-black/25` (1.77:1) | → `text-black/35` (2.4:1). (IMPECCABLE P2-6) |
| 36 | `WorkingHoursView` "OUVERT" header `w-11` (44px) collided with the next column in FR | → `w-14`. (IMPECCABLE P2-10) |
| 37 | `ProfileView` password form: no username field (Chrome logs a password-form warning) | → hidden read-only `<input autoComplete="username" name="username" value={profile?.email ?? ""} hidden tabIndex={-1} aria-hidden="true" />`. Flag: markup addition for a11y. (P2-13) |
| 38 | `app/not-found.tsx` / `EmptyState` / settings hub h1 | −0.04em → −0.05em (part of #21). |

## IMPECCABLE triage (explicit dispositions)
- **P0-1, P0-2**: *all three files are `components/auth/**`: OFF-LIMITS (login agent owns)*. Not touched. **Auth screens still ship 2.06–2.22:1 body text and 1.8–2.0:1 icons: AA-failing. Flag to LOGIN agent: swap to `text-tint-fg-green`/`text-tint-fg-amber`.**
- **P0 violations I did fix:** none were in my lane; closest equivalents fixed under #7/#8.
- **P1-2** hydration mismatch `/settings/audit`: logic (text node), out of static scope. Flag to VERIFY/audit owner. Not touched. (The module-scope `new Date()` in AuditView:77 noted.)
- **P1-9** plurals ("1 utilisateurs · 1 actifs"): needs new ICU plural **message keys** (`one/other`) in both locales; I may not add keys. Flag to i18n/ANTISLOP: `TeamView.tsx:275` + formations footer.
- **P1-10** two CTA scales (`.btn-sm` needed or settings aligned to `.btn`): needs globals.css (`.btn-sm`) **or** a broad 13→15px/h-10→h-11 change across ~20 settings buttons (FR overflow risk). Orchestrator to arbitrate; NOT applied.
- **P1-11 (icon part)**: fixed (#8). Full viewport consolidation (one position/queue) = new shared module + motion: not mine; flag.
- **P1-12** skip link: done (#18). `.segment` h-8 (32px) stays (passes WCAG 2.5.8 @24px; 44px needs `@media (pointer: coarse)` in globals.css → DSE).
- **P2-1** security-tab breadcrumb: would duplicate the EmptyState h1 with PageHeader's h1; needs arbitrator decision. Skipped: flag.
- **P2-2** `.chip { whitespace-nowrap }`: globals.css → DSE request (inline fix applied on the Categories system chip only).
- **P2-3, P2-5** jargon/apostrophes: copy is ANTISLOP's (messages/*.json). Skipped. (Noted: `messages/fr.json` mixes `'` 218× vs `’` 16×: real issue, not mine.)
- **P2-4** `:focus-visible` sets `border-radius: var(--radius-xs)` on every focused control (pill→8px morph): globals.css → DSE request.
- **P2-11** folded into P1-5 ✓. **P2-12** drop redundant DERNIÈRE ACTIVITÉ column: content decision; flag, not applied.
- **P2-13** done (#37). **P2-14** partial (#20); sparkline nudge skipped (visual metric, needs live check).
- **Inbox skeleton >15–30s w/o timeout**: logic; flag to inbox owner/VERIFY.
- Findings' own `## Motion` notes (`.btn-primary` hover scale+glow heaviness): motion agent; not mine.

## Lane / out-of-lane changes to flag (transparent list)
1. **`app/globals.css`**: added two `@theme` tokens (`--color-error-fg`, `--color-error-fg-hover`) + comments. No existing rule edited; no motion tokens touched (motion agent actively working there: they landed `.kbd`, `.row-lift`, `--transition-duration-*` during my session; both diffs coexist fine). Per charter D5, @theme additions should be orchestrator-approved as a coordinated edit: **request sign-off; revert = delete 2 lines (all `text-error-fg*` classes then silently no-op: do not merge the component diff alone).**
2. **`components/shell/BottomNav.tsx`**: strokeWidth floor 1.7→1.8 (inactive), 2.1→2.2 (active). Mission scoped me to all routes incl. shell; charter forbids shell for DESIGN FIX. Flag.
3. **`components/shell/TopBar.tsx`**: `title={t("searchPlaceholder")}` on the truncated search-affordance span. File was concurrently reworked by the motion agent (kbd refactor); edit coexists. Flag.
4. **`app/(app)/layout.tsx`**: skip link + `id="main" tabIndex={-1}` + layout made `async` with `getTranslations("shell")`. Static a11y; flag (layout semantics changed).
5. **Roles/aria:** unread dot `role="img"`; several `aria-hidden` added (a11y fixes per charter's a11y-bug exception).
6. **`components/calendar/CalendarClient.tsx:152`**: `stepRef.current = step` during render → wrapped in `useEffect`. Minimal change to make the file lint-clean (repo gate); the wiring itself is the motion agent's keyboard bridge. Flag.
7. **New module-scope pattern avoided:** no new components, no new deps, no env, no DB, no routes, no i18n keys. `messages/*.json` **not modified** (parity re-run: en 1686 ≡ fr 1686, diff []).
8. **Login near-miss:** my first tracking sweep regex (without login exclusion) flipped `app/(public)/login/page.tsx:202` −0.04→−0.05; **reverted** after discovery (verified byte-equal restore). Login diff = zero. Also `NowBar.tsx` wordmark (−0.04) restored immediately.

## Verification
- `npx tsc --noEmit`: clean (exit 0), run after every batch incl. final state.
- `npx eslint` on every touched file: clean except pre-existing warnings elsewhere (`intlLocale` unused in RequestThread/ClientDetailClient/FormationDetailClient/ReportsView, `useCallback` in PlansBoard: all untouched code, all warnings not errors).
- EN/FR parity script: `en 1686 fr 1686 diff []` ✓.
- Login page renders at 1440px post-change (screenshot `audit/audit-designfix-after.png`); server `:3000` untouched; no `next build` run.
- All other routes: signed-out → redirect to `/login`; **visual verification NOT possible**: see caveat.
- Contrast ratios quoted are computed sRGB estimates consistent with IMPECCABLE's method (spot-checked: `#B02A1F` on white ≈ 6.6:1 ✓; on `error-tint` ≈ 5.6:1 ✓; `tint-fg-green` on `success-tint` ≈ 5.9:1 ✓; `tint-fg-amber` on `warning-tint` ≈ 5.5:1 ✓).

## Not verified / open items
- No authenticated screenshot of any fix (categories table, audit table columns, containers, h1s): needs re-auth pass (VERIFY).
- FR wrapping of the newly enlarged selects/search (`w-44`/`w-64`): code-only.
- `text-[10px]` survivors (11 spots): below the 11px micro floor by design (dense grid glyphs); review if you want a hard 11px floor.
- Categories table fix not measured live (was a measured 26px overflow pre-fix); re-measure post-merge at 1440/1280/1024.
- IMPECCABLE notes its own shared-browser incident (localhost:3100): unrelated to this diff.
- IMPECCABLE_FINDINGS.md was consumed at 13:20; any edits landing after 13:30 may overlap concurrent motion/login work: expect drift, re-run live pass after merge.
