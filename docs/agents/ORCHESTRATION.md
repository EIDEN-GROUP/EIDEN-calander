# CALENDAR.: Team Orchestration Charter

> **Team:** 7-agent polish & hardening squad · **Repo:** `/Users/marouaneakrich/Desktop/projects-eiden/eiden-calander` (branch `main`) · **Issued:** 2026-11-16 · **Author:** Orchestrator (agent #7)
> **Status:** Binding for every teammate. Violations = diff rejected, no exceptions, no "small fix" merges.
> Companion docs: `docs/BRAND.md` (brand law), `docs/ARCHITECTURE.md` (system), `docs/AGENTS.md` (repo operating manual, DoD §4, gates §5), `PLAN.md` (`/Users/marouaneakrich/Desktop/projects-eiden/plans/eiden-calander/PLAN.md`) §5/§23.
> Where these conflict: **brand book > this charter > repo conventions > personal taste.**

---

## 1. Mission & non-negotiables

Ship a visually impeccable, calm, bilingual, brand-faithful CALENDAR.: no behavior changes disguised as polish, no scope creep, no test-data pollution of prod. This is a **finishing pass**, not a feature release.

Non-negotiables (from the brief, restated as law):

1. Server on `:3000` stays up. **Nobody runs `next build`, nobody kills/restarts the server.** Verification = `npx tsc --noEmit` (+ `npm run lint` if TS touched).
2. **No git commands** (add/commit/push/branch/stash). The human integrates and commits. Teammates produce diffs only.
3. **No new npm dependencies. No new pages/routes. No `.env` edits. No migrations. No DB writes.**
4. **EN/FR parity is mandatory**: every UI string via `t()`; every key in **both** `messages/en.json` and `messages/fr.json`.
5. Production DB stays clean: currently **1 admin profile · 3 system categories · 0 rooms**. (One stray booking exists: see §10, D2. Nobody touches it.)
6. Brand book wins every visual argument. Electric Blue `#0066CC` signals **presence/action only**.

---

## 2. Ground truth (snapshot, 2026-11-16, HEAD `3d469e3`)

| Area | State |
|---|---|
| Stack | Next 16.4.6 (App Router, `cacheComponents`), React 19.3, Tailwind v4 (`@theme` in `app/globals.css`), next-intl v4 (cookie `locale`), Supabase (RLS, live) |
| Size | ~28k LOC TS/TSX across `app/`, `components/`, `lib/` |
| i18n | **1651 keys EN ≡ 1651 keys FR: parity verified programmatically.** `messages/en.json` + `fr.json` are the canonical files (imported by `i18n/request.ts`) |
| Typecheck | `npx tsc --noEmit` clean at HEAD |
| Prod build | Serving on `:3000` (`curl /login` → 200). Do not touch |
| `messages/parts/` | **Stale intermediate artifacts** from generation; 3 sections drifted (`calendar`, `common`, `settings`) and nothing imports them. Read-only reference; canonical = `messages/*.json`. See D1 |
| Token leaks | ~20 hardcoded hex in components (e.g. `#a34d00`, `#B02A1F`, `#1E6B31`, `#A34D00`) instead of token utilities/tints: catalog for DESIGN FIX |
| Brand violations spotted | `components/dashboard/DashboardView.tsx`: `bg-gradient-to-r from-electric to-[#3d8bff]` (gradients + off-book hex: both banned) |
| Login artwork | Hardcoded **French** strings in `app/(public)/login/page.tsx` `BrandArtwork` (`React Avancé — Session 3`, etc.) despite being user-visible text: i18n violation, though `aria-hidden` |
| Repo hygiene | `.playwright-mcp/`, `test-results/`, `tsconfig.tsbuildinfo` are gitignored or ignored-by-status; tree was clean at HEAD |
| e2e | `e2e/` smoke specs are read-only (no creates); auth spec requires `E2E_EMAIL`/`E2E_PASSWORD` |

---

## 3. The quality bar (all agents)

Layered on `docs/AGENTS.md` §4 (DoD) and §5 (gates). A diff is not reviewable until its author answers:

1. **What changed and why**: one paragraph, in plain words.
2. **Files touched**: list; anything outside your lane = auto-reject.
3. **Verification run**: `npx tsc --noEmit` output (paste tail), plus any targeted check.
4. **i18n**: keys added/changed in **both** locales (or "none"); placeholder integrity confirmed.
5. **Risk & rollback**: what could this break; how the human reverts (file list).

Reviewer (me) checks five axes, in order: **correctness → brand → i18n → a11y → scope.** "Nice" passes nothing; only evidence passes.

### Definition of "done" for this effort (per diff)

- [ ] `npx tsc --noEmit` clean; `npm run lint` clean on touched files if TS/TSX
- [ ] No new hex/rgb/rgba literals outside `app/globals.css` `@theme` and `components/brand/` SVGs
- [ ] i18n parity held (§6 below); zero hardcoded UI strings
- [ ] Hover/focus/active/disabled/error/empty/loading states all intentional (not just the happy path)
- [ ] `prefers-reduced-motion: reduce` honored for every new/changed animation
- [ ] Focus-visible ring intact (BRAND.md §6.10); no `outline: none` without the ring
- [ ] EN **and** FR render-checked (strings fit, no clipped/overflowing pills)
- [ ] No logic changes, no behavioral regressions, no silent scope creep
- [ ] Report filed: `docs/agents/<NAME>_REPORT.md` (see §9)

---

## 4. Design tokens to respect (law of the repo)

Source: `docs/BRAND.md` + `app/globals.css` `@theme`. **Use token utilities, never literals.**

- **Canvas `#F5F5F7`** app bg · **Surface `#FFF`** cards · **Obsidian `#1D1D1F`** headings/mark · **Obsidian Light `#424245`** body · **Muted `#6E6E73`** meta only, ≥13px
- **Electric `#0066CC`** = present/active/primary/focus **only**. Hover `#005BB5`. Tints `electric-tint(.10)` / `-strong(.16)`. Never a decorative fill, never a gradient stop, never body text on tint without `#005BB5`
- Success/Warning/Error are **accents/icons**, never body-size text on white: use paired tint foregrounds (`tint-fg-*`, or the dark tint exceptions catalogued in §10 D5)
- **Category tints:** presets only (`tint-blue/green/purple/amber/teal/rose` + `tint-fg-*`), fill 10–12% alpha, paired fg ≥ 4.5:1. No ad-hoc colors, **no gradients anywhere in product UI**
- **Radius:** `xs 8 / sm 12 / md 20 / lg 32 / pill 999` · inputs 14px · **Shadows:** `sm/md/lg/electric` only, no darker/colored glows except Electric glow on primary hover
- **Type:** SF system stack; wordmark 800/−0.04em; display −0.06em; title −0.05em; label +0.08em caps 11px/700; body 17–18px/400 Obsidian Light; mono for refs/IDs/timestamps
- **Motion:** `--ease-apple` cubic-bezier(.25,1,.5,1); micro .2s, layout .4s; card lift `translateY(-3px) + shadow-lg`; floats 7–10s; **always** `prefers-reduced-motion`-gated
- **Now Principle:** the 4px Electric bar marks genuinely active elements **only**: never decoration
- **Frosted bars:** `.frosted` (0.8 alpha + blur 24px + hairline border): never opaque, never blur w/o the alpha

Known offenders to fix (DESIGN FIX, static): the ~20 hex literals (map each to the nearest token: e.g. `#a34d00` → `text-tint-fg-amber`, `#B02A1F` → dark error tint fg, `#1E6B31` → `text-tint-fg-green`), and the dashboard gradient (→ solid Electric or tint, no gradient, no `#3d8bff`).

---

## 5. Team roster, ownership map & hard boundaries

| # | Agent | Owns (write access) | Forbidden (read-only at best) |
|---|---|---|---|
| 1 | **ANTISLOP** (`antislop`, `antislop-copywriting`, `antislop-code`) | `docs/**` prose & all `.md` (README, RUNBOOK, USER_MANUAL, ARCHITECTURE, SECURITY…); code comments; **wording** of UI strings in `messages/*.json` | Keys in messages (no renames); JSX structure; classNames; tokens; logic; `globals.css`; visual design; copy meaning/claims |
| 2 | **IMPECCABLE** (`design-review`) | `docs/agents/IMPECCABLE_FINDINGS.md` (+ assets under `docs/agents/` if needed) | Everything else: **strictly read-only**, no fixes, no "quick wins" |
| 3 | **DESIGN FIX** | Static styling in `components/**` and `app/**` (spacing, contrast, hierarchy, states, alignment, truncation, token substitution) | `components/shell/**`, `components/auth/**`, `app/(public)/login/**`, `globals.css`, ALL motion (transitions/animations/keyframes/easing), all copy/i18n strings, JS logic, markup semantics (roles/aria unchanged unless fixing an a11y bug: flag it) |
| 4 | **LOGIN** | `app/(public)/login/**`, `components/auth/**` (new MosaicStage etc.) | `globals.css` (additive-only, no edits to existing rules); shell; feature modules; messages outside `login.*` (may add `login.*` keys, parity required); the right panel's existing strings (improve only via t() keys) |
| 5 | **UI/UX+MOTION** | `components/shell/**`, `globals.css` (motion/token additive), new modules `components/keyboard/**`, `components/command/**` (palette, shortcuts) | Feature components (except zero-logic wiring via shell); `app/(public)/login/**`; migrations; routes (palette is a component, not a page) |
| 6 | **VERIFY** | `e2e/**`, `docs/agents/VERIFICATION.md` | All app code: files defects, fixes nothing; no DB writes; no prod data creation without explicit human approval |
| 7 | **ORCHESTRATOR** (me) | `docs/agents/ORCHESTRATION.md`; review verdicts | All code (I write no product code) |

**Universal rules**

- Stay in your lane. Need another lane? **Go through me.** Never "just do it quickly."
- Two agents, one file → owner wins; non-owner waits or splits the diff.
- Every agent reports to `docs/agents/<NAME>_REPORT.md` when done (template §9).

---

## 6. i18n rules (EN/FR parity)

1. Canonical files: `messages/en.json`, `messages/fr.json`. `messages/parts/` is stale: **do not edit** (D1).
2. Key sets must remain identical: adding/removing/renaming a key requires both files + any code references in the same diff.
3. Net-new keys: namespaced under the owning surface (`shell.*` for palette/shortcuts, `login.*` for login). Both locales, real translations (no English left in `fr.json`), placeholders `{count}` style preserved.
4. ANTISLOP may rewrite *wording*; it may not change placeholders, ICU plural syntax, or meaning.
5. Verify parity (paste into your report):

```bash
node -e "const en=require('./messages/en.json'),fr=require('./messages/fr.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v!==null?f(v,p+k+'.'):[p+k]);const a=f(en),b=f(fr);console.log('en',a.length,'fr',b.length,'diff',[...a.filter(k=>!b.includes(k)),...b.filter(k=>!a.includes(k))])"
```

6. Dates/numbers via `Intl` (`lib/intl-locale.ts`), not hand-formatted; currency MAD, tz `Africa/Casablanca`.
7. Brand-locked proper nouns stay untranslated: `CALENDAR.`, `Now-Bar`, `Eiden Group`, `eiden-group.com`, plan/category names where product-meaningful.

---

## 7. Conflict-resolution rules

Order of precedence for any disagreement:

1. **Brand book / `docs/BRAND.md`**: absolute on visuals.
2. **This charter + `docs/AGENTS.md`**: process and repo law.
3. **PLAN.md**: product decisions (D-numbers).
4. **Current code**: only where silent; never overrides 1–3.

Specific mechanisms:

- **`globals.css` is single-owner at a time.** UI/UX+MOTION owns it during the motion phase (additive only, token-based, no edits to existing rules without my sign-off). DESIGN FIX treats it as read-only: requests go through me. LOGIN may append mosaic-specific keyframes/utilities only, and only after UI/UX+MOTION lands (or in parallel strictly in its own appended block, flagged in report).
- **`messages/*.json`:** ANTISLOP (wording) ∥ LOGIN (`login.*` additions) ∥ UI/UX+MOTION (`shell.*` additions): each in its namespace, parity mandatory, my count-check before SHIP.
- **Copy edits vs DESIGN FIX:** ANTISLOP never touches JSX; DESIGN FIX never touches strings. Overlap impossible by construction: if it happens, ANTISLOP's version of meaning wins, DESIGN FIX's version of layout wins, diff split and re-reviewed.
- **Static fix vs motion:** if a fix wants a transition/easing change → it belongs to UI/UX+MOTION, not DESIGN FIX. Rejected diff otherwise.
- **LOGIN vs UI/UX+MOTION:** LOGIN owns login only; palette/shortcuts are shell. The ⌘K field in `TopBar` is UI/UX+MOTION's to wire; LOGIN must not steal it.
- **Findings vs fixes:** IMPECCABLE's findings are inputs, not mandates. DESIGN FIX implements; I arbitrate which findings ship.
- **Tie-break:** when two reasonable paths exist, the one with less new surface wins. When one violates the brand book even slightly, it loses automatically. My call is final; disagreements logged in §10 decisions log.

---

## 8. Order of operations

```
Phase 1 (now, all parallel: disjoint files)
  ├─ IMPECCABLE      read-only audit → docs/agents/IMPECCABLE_FINDINGS.md
  ├─ LOGIN           port reference left mosaic stage → components/auth + login route
  ├─ UI/UX+MOTION    motion system · global shortcuts · ⌘K palette · shell polish
  └─ ANTISLOP        docs & prose only (defer code comments + UI strings)

Phase 2 (starts when IMPECCABLE lands AND Phase 1 shell/login diffs are merged-by-human or stable)
  └─ DESIGN FIX      static fixes, guided by findings; rebases onto landed globals.css; no motion

Phase 3 (after fixes land)
  └─ ANTISLOP        code comments + UI string wording pass (messages/*.json), parity-checked

Phase 4 (after everyone)
  └─ VERIFY          EN/FR walkthrough · E2E · a11y · console · regression report

Phase 5
  └─ ORCHESTRATOR    integration sign-off (§12)
```

Rules: no waiting idle: if blocked, say so immediately (via the human) with the blocker stated. No agent may "help" in another's lane because they finished early. VERIFY may not start before Phases 1–3 report done.

---

## 9. Review protocol & verdicts

**Submission:** teammate (via human) shares diff or `git diff` output + their `docs/agents/<NAME>_REPORT.md`.

**My review axes:** correctness (does it do what it claims?) · brand (tokens/blue semantics/now-bar) · i18n (parity §6) · a11y (keyboard, ring, contrast, reduced-motion, aria) · scope (lane discipline §5).

**Verdicts:**

- **SHIP**: meets the bar; human may integrate. Evidence listed.
- **FIX-FIRST**: specific required changes enumerated; no re-review until all addressed + evidence re-pasted.
- **BLOCKED / REJECTED**: scope violation or brand/i18n break; diff discarded, resubmit from clean base.

Each agent's report must contain (template):

```
# <NAME>: Report
Summary · Files touched (full list) · Verification (tsc tail / lint / parity check) ·
i18n keys added/changed (EN+FR) · Visual states verified (320/768/1280/1440) ·
Reduced-motion handling · Open items / risks · Rollback plan
```

**Automatic FIX-FIRST triggers:** hex literals in components; gradient anywhere; blue used decoratively; `outline:none` w/o ring; missing FR key; hardcoded UI string; logic change in a "polish" diff; file outside lane; `next build` evidence; unrequested opacity/color drift; now-bar on inactive elements.

**Automatic REJECT triggers:** new dependency; new route/page; `.env` touched; migration; writes to prod DB; deleted/weakened test; suppressed type error without issue link.

---

## 10. Known issues & decisions log

| # | Decision / finding | Ruling |
|---|---|---|
| D1 | `messages/parts/` stale (3 sections drifted; unimported) | Read-only historical. Canonical = `messages/*.json`. No agent edits or deletes `parts/`; human decides on removal |
| D2 | Prod booking `tt` (2026-11-16, by admin, confirmed): not in the "1 admin / 3 categories" contract | Nobody deletes/edits it (not ours, not mine). VERIFY notes it, treats counts as "≥ baseline". Flagged to human in my report: if it's accidental test data, human deletes out-of-band |
| D3 | Login reference HTML (`calendar_login_page.html`) is a **design source, not a spec** | Its sign-up mode / "Create a free account" toggle and auth-mode switching are **not portable**: no self-registration, internal staff-only. Drop them entirely. Right-panel structure/strings stay localized via `login.*` keys |
| D4 | Current login artwork strings are hardcoded French in `BrandArtwork` (`aria-hidden`) | Must be localized (`login.artwork*` keys, EN/FR) or made language-neutral before SHIP. LOGIN and/or DESIGN FIX owns; I sign off on the choice |
| D5 | Hardcoded "dark tint" error/warning hexes (`#B02A1F`, `#8F1F16`, `#a34d00`, `#A34D00`, `#c22a22`) scattered in components | These are the de-facto error/warning body-text colors (AA on tints). Substitute with a token where one exists; where none exists, escalate to me: if approved, add as `@theme` tokens in a single coordinated edit (owner: me to assign), never ad-hoc per file |
| D6 | Dashboard gradient `from-electric to-[#3d8bff]` | Brand violation (gradient + off-book hex + blue-as-decoration). DESIGN FIX: replace with solid Electric or `electric-tint-strong` fill, no gradient. Needs re-check it still reads as a progress bar |
| D7 | Reference mosaic is kinetic (waves, magnetic cursor, pause pill) | LOGIN may port motion; it must be `prefers-reduced-motion`-gated, decorative (`aria-hidden`), zero keyboard traps; the pause/play control is a real `<button>` with `aria-pressed` + localized label; alt-text-free; no layout shift |
| D8 | ⌘K entry exists in TopBar but is unwired | UI/UX+MOTION wires it to the palette. Escape closes; ↑↓/Enter navigate; focus returns to trigger; body scroll locked; `aria-modal` + labelled dialog; works in EN/FR |
| D9 | Focus order / sticky bars / z-index untouched unless fixing a real a11y bug | All changes additive; z-index only within existing tiers (shell 30/40, overlays ≥50): flag any new stacking context in report |
| D10 | Gradients behind login artwork (`radial-gradient` light pools) | Borderline; keep only if they read as flat light, not gradients. IMPECCABLE judges; default = flatten or drop |
| D11 | No agent runs `next build` or restarts `:3000` | Verified by `tsc --noEmit` only. If a change genuinely needs a build to validate (it shouldn't), it goes through the human |
| D12 | `docs/agents/` report convention | Each agent drops `docs/agents/<NAME>_REPORT.md`; human pastes summaries to me; I review the diff myself (`git diff`, untracked files): reports are context, the diff is the truth |

---

## 11. The five hard gates (top-5 pass/fail, every teammate)

1. **Build integrity**: `npx tsc --noEmit` clean; lint clean; the `:3000` server untouched. (Build evidence absent: not applicable and not permitted.)
2. **i18n parity**: key counts equal in EN/FR (paste §6 output); no key renamed unreferenced; zero hardcoded UI strings; placeholders intact; FR actually translated.
3. **Token discipline**: zero new raw hex/rgb/rgba outside `globals.css` `@theme` + `components/brand/`; no gradients; radii/shadows/easing from tokens; blue only for now/active/primary; Now-bar only on truly active elements.
4. **Scope & safety**: diff confined to owned paths (§5); no logic changes; no new deps/routes/migrations/env writes; prod DB untouched; server running; no deleted/weakened tests.
5. **Accessibility floor**: keyboard operable everywhere; `:focus-visible` ring (BRAND.md §6.10) never removed; contrast ≥ 4.5:1 body / ≥ 3:1 large & UI; aria correct & not degraded; **all** animation gated by `prefers-reduced-motion` with a static (non-janky) fallback.

A diff failing any gate = FIX-FIRST (or REJECTED for #4), no matter how pretty it is.

---

## 12. Integration sign-off criteria (Phase 5, mine)

I sign off when **all** hold:

- All six teammates SHIP (or their FIX-FIRST loops closed with evidence).
- VERIFY report (`docs/agents/VERIFICATION.md`): EN/FR walkthrough clean both locales, E2E green (or justified skips documented), axe/pa11y AA pass with zero critical, console clean, no layout shift at 320/768/1280/1440, regressions = 0 open P0/P1.
- Parity re-verified at integration HEAD (§6 command) = equal counts.
- Prod DB baseline unchanged (1 admin / 3 categories / rooms 0; stray booking documented).
- Remaining knowns listed as deferred with owner + reason: never silently dropped.
- Human has the rollback file list (what to revert, in what order).

**Deferred-by-default (not this effort):** CSP nonces (Phase 4, PLAN §21), `messages/parts/` removal, dark mode, `components/ui/` extraction, TypeScript `database.types.ts` regen.

---

## 13. Quick reference: commands

```bash
npx tsc --noEmit                    # the only build-ish check allowed
npm run lint                        # on touched files
node -e "<§6 parity script>"        # EN/FR parity: paste result in report
git status --short && git diff --stat   # review-only; never run git mutation commands
grep -rn '#[0-9a-fA-F]\{3,8\}' components app --include='*.tsx'   # token-leak sweep
```

**Escalation path:** teammate → (via human) → me. I answer decisively; no options menus. Decisions land back in §10.
