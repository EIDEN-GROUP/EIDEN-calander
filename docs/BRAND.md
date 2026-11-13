# CALENDAR. — Brand Book for Developers

**CALENDAR.** — *Architecture for Time.* — by **Eiden Group** (https://eiden-group.com).

This document is the canonical brand reference for anyone implementing UI in this repo. The brand book ("brand-book-calander.html") is the upstream source; the tokens are implemented in `app/globals.css` under `@theme` and consumed as Tailwind utilities (`bg-canvas`, `text-obsidian`, …). **Never hardcode a hex value in a component** — use the token/utility. If a token is missing, add it to `globals.css` (Design Systems Engineer), not inline.

---

## 1. The Mark — "Now-Bar"

An Obsidian "C" with an Electric Blue rounded pill — the letter *C* formed by the arc, the pill as "now" (the current moment; see *The Now Principle*, §7.4).

### 1.1 SVG source (reproduce exactly)

```svg
<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CALENDAR.">
  <path d="M 124 32 L 80 32 C 53.4903 32 32 53.4903 32 80 C 32 106.51 53.4903 128 80 128 L 124 128"
        fill="none" stroke="#1D1D1F" stroke-width="32"/>
  <rect x="96" y="52" width="24" height="56" rx="12" fill="#0066CC"/>
</svg>
```

- Canonical viewBox: `0 0 160 160`.
- Arc stroke: `#1D1D1F`, width `32`, butt caps, open path (no fill).
- Pill: `x=96 y=52 w=24 h=56 rx=12`, `#0066CC`.
- Reference implementation: `components/brand/NowBar.tsx` (`<NowBarMark/>`), plus `<Wordmark/>` and `<Logo/>` (mark + wordmark lockup, `gap-3`).
- Implemented favicon/app icon: `app/icon.svg` — Canvas rounded-rect (`rx=36`) backdrop with the mark; `app/favicon.ico` also present. Wire icons through `app/layout.tsx` metadata (`icons.icon = "/icon.svg"`).

### 1.2 Variants

| Variant | Arc | Pill | Use |
|---|---|---|---|
| **obsidian** (default) | `#1D1D1F` | `#0066CC` | On Canvas/white surfaces |
| **white** | `#FFFFFF` | `#0066CC` | On Obsidian/dark surfaces |
| **mono** | `currentColor` | `currentColor` | Single-color contexts: print, email signature, watermarking |

### 1.3 Clear space

Maintain a margin on **all sides** equal to the **width of the blue pill** — i.e. `24` units in the 160-unit box (15% of the mark's width). No type, graphics or layout elements may enter this zone. In the lockup (mark + wordmark), the same rule applies to the overall bounding box.

### 1.4 Minimum sizes

- Mark alone: **24 px** minimum (16 px favicon only as a raster/`.ico`, never re-set below 24 px for SVG usage).
- Lockup (mark + wordmark): **120 px** minimum width.
- Below 120 px, use the mark alone with the wordmark only in surrounding text.

### 1.5 The Wordmark

`CALENDAR` set in **800 (ExtraBold) weight, tracking −0.04 em**, followed by an **Electric Blue period**: `CALENDAR.`

- Do **not** render the tagline as part of the wordmark. "Architecture for Time." is a tagline, not a logotype suffix.
- Do **not** letterspace-caps `CALENDAR` further than −0.04em, re-weight it, outline it, or replace the period with another color/dot.

---

## 2. Color tokens

Canonical values. CSS custom properties as declared in `app/globals.css` (`@theme`).

| Token | CSS var | Hex / value | Role & rules |
|---|---|---|---|
| Canvas | `--color-canvas` | `#F5F5F7` | App background. Never pure white. |
| Surface | `--color-surface` | `#FFFFFF` | Cards, inputs, modals, event cards. |
| Obsidian | `--color-obsidian` | `#1D1D1F` | Primary text, mark arc, brand ink. ~16:1 on Canvas. |
| Obsidian Light | `--color-obsidian-light` | `#424245` | Body/secondary text. ≥ 9:1 on Canvas/white. |
| Muted | `--color-muted` | `#6E6E73` | Tertiary/meta text only — never below 13px. |
| Electric Blue | `--color-electric` | `#0066CC` | The one accent. Primary actions, **present/active state only**. 5.6:1 on white. |
| Electric Hover | `--color-electric-hover` | `#005BB5` | Hover/active for Electric elements. |
| Electric Tint | `--color-electric-tint` | `rgba(0,102,204,0.10)` | Selected rows, active rail buttons, focus fills. |
| Electric Tint Strong | `--color-electric-tint-strong` | `rgba(0,102,204,0.16)` | Selection backgrounds, active chips. |
| Success | `--color-success` | `#34C759` | Success states/icons only — **not** a text color on white. |
| Success Tint | `--color-success-tint` | `rgba(52,199,89,0.14)` | Success chip/banner backgrounds. |
| Warning | `--color-warning` | `#FF9F0A` | Warning icons/accents — **not** a text color on white. |
| Warning Tint | `--color-warning-tint` | `rgba(255,159,10,0.16)` | Warning banner backgrounds (e.g. booking conflict). |
| Error | `--color-error` | `#FF3B30` | Error icons/large text. For body-size error text use a darkened tint foreground (see §6). |
| Error Tint | `--color-error-tint` | `rgba(255,59,48,0.12)` | Error banner/chip backgrounds. |
| Border | `--color-border` | `rgba(0,0,0,0.08)` | Hairline borders on all surfaces. |
| Divider | `--color-divider` | `rgba(0,0,0,0.04)` | Inner dividers, blueprint grid lines. |
| Surface Elevated | `--color-surface-elevated` | `rgba(255,255,255,0.80)` | Frosted bars & sticky headers (with `blur(24px)`). |
| Track | `--color-track` | `rgba(118,118,128,0.12)` | iOS segmented-control track. |
| Hover Fill | `--color-hover-fill` | `#E5E5EA` | Secondary button hover. |
| Focus Ring | (base layer) | `0 0 0 3px canvas, 0 0 0 6px rgba(0,102,204,0.45)` | `:focus-visible` — always visible, never `outline: none` without this. |

**Contrast policy (WCAG 2.1 AA):** body text ≥ 4.5:1; large text/UI ≥ 3:1. Obsidian on Canvas and Obsidian Light on Surface both pass AA comfortably. Electric Blue passes AA on Canvas/white — do not place Success/Warning solid fills behind white text (both fail); use tints with dark foregrounds instead.

---

## 3. Typography

### 3.1 Font stack (exact, native SF — no webfonts, no external requests)

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
             "Segoe UI", "Helvetica Neue", Arial, sans-serif;
```

Mono (codes, booking refs, IDs):

```css
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
```

### 3.2 Tracking (letter-spacing) tokens

| Token | Tracking | Applies to |
|---|---|---|
| Display | **−0.06em** | Hero / display sizes (≥ 48px) |
| Title | **−0.05em** | Page titles & section headings (20–40px) |
| Tight | **−0.02em** | Lead / body-large, card titles (17–19px) |
| Label | **+0.08em** | Uppercase micro-labels (11px, 700 weight) — see `.label` |
| Wordmark | **−0.04em** | `CALENDAR.` only |
| Body | 0 | Default 17px body |

### 3.3 Typographic scale

| Role | Size / line-height | Weight | Color |
|---|---|---|---|
| Display / Hero | 56–80px / 1.05 | 800 | Obsidian |
| Page title | 32–40px / 1.1 | 800 | Obsidian |
| Section heading | 22–28px / 1.2 | 700 | Obsidian |
| Card title | 17–19px / 1.35 | 700 | Obsidian |
| **Body** | **17–18px / 1.5** | **400** | **Obsidian Light** |
| Meta / caption | 12–13px / 1.4 | 500–600 | Muted |
| Micro label | 11px / 1.2 uppercase +0.08em | 700 | Obsidian Light |
| Code / IDs | 13–15px mono | 400–500 | Obsidian |

Rules: headlines are tight and heavy; body copy is relaxed (400 / 1.5). Never use pure black; never set Electric Blue as paragraph text on tinted backgrounds unless contrast-verified.

---

## 4. Geometry

### 4.1 Radii

| Token | `--radius-*` | Value | Use |
|---|---|---|---|
| XS | `--radius-xs` | **8px** | Focus ring radius, tags, small chips |
| SM | `--radius-sm` | **12px** | Small cards, avatars containers |
| MD | `--radius-md` | **20px** | Event cards, content cards |
| LG | `--radius-lg` | **32px** | Sheets, large panels, hero stage |
| Pill | `--radius-pill` | **999px** | Buttons, pills, bars, the Now pill |
| *(input)* | — | 14px | Text inputs (`.input` uses `rounded-[14px]`; pill inputs exist as `.input-pill`) |

### 4.2 Shadows (canonical)

| Token | `--shadow-*` | Value | Use |
|---|---|---|---|
| SM | `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.04)` | Resting cards |
| MD | `--shadow-md` | `0 8px 24px rgba(0,0,0,0.06)` | Event cards (resting), popovers |
| LG | `--shadow-lg` | `0 24px 48px rgba(0,0,0,0.08)` | Hover/float, modals |
| Electric (glow) | `--shadow-electric` | `0 8px 24px rgba(0,102,204,0.3)` | Primary button hover |

### 4.3 Motion

| Token | Value |
|---|---|
| Easing | `cubic-bezier(0.25, 1, 0.5, 1)` (`--ease-apple`) |
| Duration — micro | **0.2s** (buttons, chips, rail buttons) |
| Duration — layout | **0.4s** (sheets, toasts, card lift) |
| Card lift | `translateY(-3px)` + `shadow-lg`, transition `0.25s var(--ease-apple)` |
| Float animation | `floaty` 7–10s ease-in-out, login artwork only; disabled under `prefers-reduced-motion` |

Always honor `prefers-reduced-motion: reduce` — decorative animation must stop; state changes may keep instant/short transitions.

---

## 5. Spacing & layout

- Base grid 4px; default content rhythm 8/12/16/24/32/48/64.
- Page gutter: 16px mobile / 24px tablet / 32–48px desktop.
- Sticky headers: frosted (§6.6), height 56–64px, hairline bottom border.
- Blueprint grid background (`.blueprint-grid`) for hero/empty states only — 40px cells, `rgba(0,0,0,0.04)` lines.

---

## 6. Components

### 6.1 Buttons (`.btn`)

Base: inline-flex, h-11, `rounded-pill`, px-6, 15px/600, gap-2, transition all `.2s var(--ease-apple)`, no layout shift on hover.

| Variant | Class | Resting | Hover / active |
|---|---|---|---|
| **Primary** | `.btn-primary` | Electric `#0066CC`, white text | bg `#005BB5`, **glow `0 8px 24px rgba(0,102,204,0.3)`, `transform: scale(1.02)`** |
| **Secondary** | `.btn-secondary` | Canvas `#F5F5F7` bg, Obsidian text | bg `#E5E5EA` |
| **Ghost** | `.btn-ghost` | Transparent, Obsidian Light text | bg `rgba(0,0,0,0.04)` |
| **Danger** | *(add on demand)* | Error-tint bg, dark error text | per §6.7 tints — never solid red |

Primary is Electric **only when it performs the primary action for the current screen** (e.g. "Create booking"). One primary per view.

### 6.2 Inputs (`.input` / `.input-pill` / `.label`)

- Label: 11px, 700, uppercase, +0.08em, Obsidian Light, `mb-1.5`.
- `.input`: h-11, radius **14px**, white bg, `1px` border `--color-border`, px-4, 15px text; placeholder `black/30`; focus → `border rgba(0,102,204,0.5)` + `0 0 0 4px var(--color-electric-tint)`.
- `.input-pill`: h-12, radius pill, px-5, 16px — for hero/search fields.
- Checkboxes/toggles are Electric-tinted when on (`--color-electric` track). Error state: `--color-error` border + `--color-error-tint` ring + message in dark tint foreground (§6.7).

### 6.3 Segmented control (iOS-style)

```css
.segmented      { display:inline-flex; background: rgba(118,118,128,0.12); border-radius: 9px; padding: 4px; }
.segment        { height: 32px; padding: 0 16px; border-radius: 7px; font-size: 13px; font-weight: 600; color: Obsidian; background: transparent; }
.segment-active { background: #FFFFFF; box-shadow: 0 3px 8px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.04); }
```

Used for view switching (Day / Week / Month, EN / FR, All / Today). Max 5 segments; always exactly one active; never use Electric inside the segment itself (active = white pill, not blue).

### 6.4 Event card

- Surface: white, radius **20px** (`--radius-md`), border hairline, **shadow-md**.
- **Left bar: 4px Electric Blue** (`.now-bar`, `rounded-pill`) pinned to the card's left edge — the "Now Principle": the bar marks the *present/active* event. Only render it for the genuinely active/current event — never as decoration.
- Hover: lift `translateY(-3px)` + **shadow-lg** (`.card-hover`), `0.25s var(--ease-apple)`.
- Content: time range (mono 13px, tight), title (17px/700, Tight tracking), room + client chips (§6.5), attendee **avatar group** overlapping by **−8px** (`-ml-2` on siblings), 28px circles, white 2px ring.
- Status chips: confirmed/pending tint per §6.7; declined/cancelled in Muted.

### 6.5 Chips

`.chip`: inline-flex, pill, px-2.5 py-1, 11px/600, tint bg + dark tint fg (§6.7), optional leading dot. Never solid saturated fills.

### 6.6 Frosted sticky bars

```css
.frosted {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
```

All sticky headers/toolbars use `.frosted`. Never opaque bars; never blur without the 0.8 alpha; the hairline bottom border is mandatory. Content must remain usable under reduced transparency (`@supports` fallback: `rgba(255,255,255,0.95)`, no blur).

### 6.7 Category tint presets (policy)

Categories/rooms/formations get **muted, translucent tints** — never vivid fills, **never gradients**. Presets from `globals.css`, each with a paired foreground (all verified ≥ 4.5:1 on the tint):

| Preset | Background | Foreground |
|---|---|---|
| Blue | `rgba(0,102,204,0.12)` | `#005BB5` |
| Green | `rgba(36,138,61,0.12)` | `#1E6B31` |
| Purple | `rgba(94,92,230,0.12)` | `#4B49C8` |
| Amber | `rgba(201,106,0,0.12)` | `#A34D00` |
| Teal | `rgba(10,132,255,0.12)` | `#0066CC` |
| Rose | `rgba(216,27,96,0.10)` | `#B0256B` |

Policy: (1) pick from presets only — no ad-hoc hex per category; (2) foreground ≥ 4.5:1 on its tint; (3) tints are backgrounds — text always the paired foreground; (4) no gradients anywhere in product UI; (5) re-check contrast when adding a preset (Design Systems Engineer signs off).

### 6.8 Cards

`.card`: white, radius 20px, hairline border, shadow-sm. `.card-hover`: the lift behavior from §4.3. Elevated/featured surfaces use white + shadow-md, not darker fills.

### 6.9 Icon rail & nav

`.rail-btn`: 48px circle, white bg, hairline border, shadow-sm, Obsidian Light icon; hover → lift + Obsidian icon; `[data-active="true"]` → Electric tint bg, Electric icon, `rgba(0,102,204,0.25)` border. Active nav item = Electric tint + Electric icon — never a solid Electric circle.

### 6.10 Focus-visible (accessibility floor)

```css
:focus-visible { box-shadow: 0 0 0 3px var(--color-canvas), 0 0 0 6px rgba(0,102,204,0.45); border-radius: var(--radius-xs); }
```

Never remove this. All interactive elements reachable by keyboard; focus ring always on Electric-tinted canvas halo.

---

## 7. Usage rules

### 7.1 Do

- Use Electric Blue **only** to signal *present / active / primary action* (now-bar, primary CTA, active nav, focus rings, selected state).
- Keep Canvas as the app background; white for surfaces; hairlines for separation; 1px borders everywhere.
- Set headings tight and heavy; body 17–18px/400 in Obsidian Light.
- Use the mono stack for booking references, IDs, codes and timestamps in tables.
- Compose layouts on the 4px grid; radii from §4.1 only.
- Reproduce the mark from the source in §1.1 — never redraw or rasterize-trace.

### 7.2 Don't

- **Don't** use Electric Blue as a decorative fill, section divider, gradient, or background wash.
- **Don't** put Electric Blue body text on tinted backgrounds without a contrast check (use `#005BB5`).
- **Don't** use pure `#000000` or off-book grays; use Obsidian scale (`#1D1D1F` / `#424245` / `#6E6E73`).
- **Don't** add drop shadows darker than the §4.2 scale, or colored glows other than the Electric glow.
- **Don't** stretch, recolor, outline, rotate or add effects to the mark; don't place it on busy imagery; don't re-set the wordmark.
- **Don't** use the Now-bar on non-active events — the mark means "now".
- **Don't** introduce gradients (category or otherwise) or vivid saturated category colors.
- **Don't** crowd the mark — respect the pill-width clear space (§1.3).

### 7.3 Blue = now

The meaning of Electric Blue in this system is **presence and action**: the current event (now-bar), the thing the user is doing right now (active state), and the single action they should take (primary button). Anything else painted blue is a brand violation — it trains users to ignore the color.

### 7.4 The Now Principle (summary)

*Architecture for Time* — the interface is organized around the present moment. The 4px Electric bar marks what is happening **now**; everything else recedes to Canvas/hairlines. If in doubt whether an element deserves the bar, it doesn't.

### 7.5 Favicon / app icons

- `app/icon.svg` — Canvas rounded square (`rx=36` in 160-box) + obsidian mark + Electric pill. Used as the browser/PWA icon via metadata (`icons.icon`).
- `app/favicon.ico` — legacy fallback.
- `themeColor: #F5F5F7` (Canvas), `applicationName: "CALENDAR."`, `appleWebApp` capable — see `app/layout.tsx`.
- A full PWA manifest (`app/manifest.ts`, 192/512px maskable icons) lands with the PWA workstream; icons must come from §1.1 source, not ad-hoc exports.

---

## 8. Quick reference

```css
--color-canvas: #F5F5F7;   --color-obsidian: #1D1D1F;   --color-electric: #0066CC;
--color-surface: #FFFFFF;  --color-obsidian-light: #424245;  --color-electric-hover: #005BB5;
--shadow-sm: 0 2px 8px rgba(0,0,0,.04);  --radius-md: 20px;
--shadow-md: 0 8px 24px rgba(0,0,0,.06);  --radius-pill: 999px;
--shadow-lg: 0 24px 48px rgba(0,0,0,.08);  --ease-apple: cubic-bezier(.25,1,.5,1);
ease: cubic-bezier(0.25, 1, 0.5, 1) · durations .2s / .4s
SF stack · Body 17–18px/400 Obsidian-Light · display tracking −0.06em · wordmark 800/−0.04em
```

*Questions or missing tokens → Design Systems Engineer (see docs/AGENTS.md, role #8). Brand changes require an update to this document in the same PR.*
