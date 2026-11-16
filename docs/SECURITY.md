# CALENDAR. — Security

Security posture for **CALENDAR.** (Eiden Group internal scheduling). Audience: engineers, reviewers, incident responders. Operational procedures (rotations, restores): docs/RUNBOOK.md. Data-access conventions: docs/ARCHITECTURE.md §7.

## 1. Threat model (summary)

**What we are.** An internal, single-tenant business app behind authentication. No public content, no self-signup, no OAuth. Users are Eiden Group staff; two roles: `admin`, `staff`. Shared workspace — staff see all rooms/bookings/clients/formations.

**Assets.**

1. Supabase service-role key + DB credentials (full DB access).
2. Session cookies (impersonation of any user).
3. `makrich@eiden-group.com` mailbox (sync via IMAP; send-as via SMTP).
4. Client PII (names, companies, contact details, formation attendance).
5. Business data (pricing, room utilization, plans).
6. Temp passwords at provisioning time.

**Adversaries & main threats.**

| Threat | Vector | Primary mitigations |
|---|---|---|
| Credential theft / password reuse | Phishing, stuffing | Supabase Auth, lockout (5→15 min), forced temp-password change, no OAuth surface |
| Privilege escalation staff→admin | Broken server-side checks, IDOR | `requireAdmin()` re-checks in every admin action + RLS default-deny backstop |
| IDOR (read/modify another user's data or change requests) | Guessed UUIDs, missing ownership predicates | RLS policies; server-side `where recipient_id = auth.uid()`-style scoping; UUID v4 PKs |
| XSS via rendered mail or user text | `contact@` mailbox is untrusted input | sanitize-html allowlist, sandboxed iframe, images off, output encoding |
| CSRF on mutations | Cross-site form POST | Origin/Host check + SameSite=Lax cookies |
| Session hijack | XSS/theft of cookies | httpOnly + Secure + SameSite=Lax, short-lived access tokens + refresh rotation |
| Service-key abuse | Key in client bundle / logs | server-only module, never `NEXT_PUBLIC_`, rotation runbook (RUNBOOK §9.6) |
| Mail abuse (send-as contact@) | Compromised app account | Send rate limit 30/10 min, single allowed sender, audit on every send |
| Supply chain | Malicious/typosquat dependency | Dependabot, lockfile, `npm audit` CI gate, minimal deps |
| Data exfil via exports | `/api/export/*` abuse | Admin-only, audited, rate-limited |
| Physical/verbal (shared office) | Screen glances | Short session idle timeout (30 min), clean-desk reminder — process, not code |

**Non-goals / accepted risks (documented, not hidden).**

- **No PITR** (Supabase free tier) → 7-day RPO, weekly `pg_dump`. Accepted by leadership until paid tier.
- **Shared workspace**: no per-room or per-client ACL between staff. Accepted — it is a deliberate product decision.
- **Mailbox compromise = total mailbox compromise** for `contact@`. We mitigate by making `contact@` a dedicated operational mailbox, not personal mail.
- **CSP allows `'unsafe-inline'` styles** (Tailwind v4 inline style attributes for dynamic values); scripts remain locked to `'self'`.
- Static-analysis/lint can't prove absence of logic flaws — see §9 pen-test checklist.

## 2. Control inventory

### 2.1 AuthN — Supabase email + password only

- **No OAuth, no magic links, no SSO** — email+password exclusively, by product decision.
- **No public sign-up**; accounts are created by admins with a **one-time temp password**; `must_change_password` forces a change on first login.
- Temp passwords: ≥ 16 random chars, single-use, shown once at creation, never emailed in-band with the username (channel-separated).
- Password policy: minimum **12 chars**, zxcvbn-strength check client-side and server-side; breach-ish screens deferred.
- Email confirmation: not required (admin-verified provisioning instead); recovery via admin reset only — there is **no public "forgot password"** endpoint that could be abused for enumeration. (If a reset flow is added later it must respond identically for known/unknown emails.)

### 2.2 AuthZ — RLS default-deny + server re-checks

- Every table: `rowsecurity = on`, zero public policies by default.
- `is_admin()` — security-definer function returning `exists(select 1 from profiles where id = auth.uid() and role = 'admin')`; used by admin policies; `set search_path = public` to avoid search-path hijack.
- Staff-scoped policies (own notifications, own sent change requests, profile self-read) key on `auth.uid()`.
- **Every Server Action and route handler re-checks**: `requireUser()` (session valid) → `requireAdmin()` where applicable. RLS is the backstop — the app must be correct even if a policy is later miswritten.
- Storage buckets (branding): RLS on `storage.objects`; branding bucket world-read (logo assets), writes admin-only.

### 2.3 Sessions

- Supabase SSR cookies: `httpOnly`, `Secure` (prod), `SameSite=Lax`, path `/`.
- Access token short-lived (default 1h); refresh token rotation enabled in the project settings.
- Middleware refreshes on every request; password change/deactivation → all sessions revoked (`supabase.auth.admin.signOut(userId, 'global')` on reset/deactivate).
- Idle timeout: app-level warning at 25 min, re-auth at 30 min of inactivity.

### 2.4 CSRF

- Mutations verify `Origin` (fallback `Sec-Fetch-Site` ∈ `same-origin|same-site|none`) matches the `Host`; mismatch → 403.
- `SameSite=Lax` cookies mean cross-site POSTs carry no session cookie anyway.
- Route handlers that mutate (cron, exports) additionally require the bearer secret / admin session.

### 2.5 Rate limits & throttling

| Endpoint / action | Limit | Lockout behavior |
|---|---|---|
| Login (`signIn`) | **5 consecutive failures per account** | **15-minute lockout**, `login_attempts` row; audit `auth.login.lockout`; reset by admin or SQL (RUNBOOK §9.1) |
| Change request actions | 60/min per user | 429 + audit |
| **Mail send / reply** | **30 messages / 10 minutes per user** | 429 + audit `mail.rate_limited`; hard ceiling 100/day |
| IMAP list/search/**manual refresh** | **≥ 15 s between refreshes** | 429 with `Retry-After` (server cache absorbs normal polling) |
| Export (`/api/export/*`) | 10/hour per user, admin/staff per scope | 429 + audit |
| Cron | `CRON_SECRET` bearer | 401 otherwise |
| User provisioning | 20/hour per admin | 429 + audit |

Limits live in a Postgres-backed counter (shared across serverless instances) — not in-memory.

### 2.6 HTTP security headers

Set in `next.config.ts` (`headers()`) for all routes:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), fullscreen=(self)
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

Notes: `frame-ancestors` covers clickjacking (X-Frame-Options is the legacy mirror). No `report-uri` yet — add a report endpoint when one exists. HSTS `preload` only after a clean quarter on the `includeSubDomains` config. The mail iframe uses `sandbox=""` (most restrictive — no scripts at all) via `srcDoc`, independent of `frame-ancestors`.

### 2.7 Mail-specific controls (the highest-risk surface)

`makrich@eiden-group.com` is operated by the app and rendered in the browser. Treat every byte of it as hostile.

1. **IMAP over TLS only** — port 993; no 143, no STARTTLS fallback in app config. Cert validation enforced by imapflow.
2. **`MAILBOX_ALLOWED`** — a module-level constant (`makrich@eiden-group.com`); the mail layer takes no mailbox parameter from callers. Requesting any other mailbox is a compile-time/constant error, not a runtime flag.
3. **HTML sanitization** — all rendered message bodies pass through `sanitize-html` with an allowlist: `p, br, strong, em, u, s, a[href mailto/http(s) only], ul, ol, li, blockquote, table, thead, tbody, tr, th, td, img[src https? — see images-off]`; **no** `script, iframe, object, embed, form, input, style, link, meta, base`; all `on*` attributes stripped; `href` limited to `http/https/mailto`, auto-`rel="noopener noreferrer nofollow"` + `target="_blank"`; `style` attribute stripped or property-allowlisted (no `position`, `url()`, `expression()`).
4. **Images off by default** — remote images never auto-load; a per-message "Show remote content" toggle (audited `mail.images_load`) renders via the sanitized doc; `data:`/`blob:` imgs stripped.
5. **Sandboxed iframe** — body renders into `<iframe sandbox="" srcDoc={sanitized}>`; no scripts, no forms, no same-origin; parent never reaches into its DOM; height auto via postMessage with strict origin/type validation.
6. **Attachments** — content sniffed (magic bytes), not just MIME from headers; executable types (`exe, scr, js, jar, msi, com, pif, cmd, bat, ps1, vbs, hta, dll, lnk, iso, cab, svg`) **never rendered or opened — always force-download** with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; size cap **25 MB**; filenames sanitized (path separators, `..`, control chars stripped).
7. **No delete / no move** — the app cannot delete or move messages/mailbox folders. Hostinger's webmail is the source of truth; a bug or a malicious staff member cannot destroy mail via the app. (Allowed writes: `\Seen` flag only.)
8. **Reply security** — quoted original is sanitized identically before embedding in `In-Reply-To`/`References`-linked replies; quote prefix `>` forced; reply-to address comes from the parsed `From:` (validated RFC 5322, no header injection — CR/LF stripped); spoofed `From` display names are shown verbatim but never trusted (address is authoritative, rendered monospace).
9. **`.eml` body cap — 1 MB** for any stored/forwarded raw message; anything larger is truncated with a notice, never fully buffered into memory or Postgres.
10. **Headers of outbound mail** — app sets `Message-ID`, `Date`, proper `In-Reply-To`; DKIM/SPF alignment with `contact@` mailbox per Hostinger config; no `Bcc` injection — recipients only from the reply flow/explicit compose.
11. **Mailbox credentials** (`IMAP_PASSWORD`/`SMTP_PASSWORD`) are server-only env, never sent to the client, never logged; failures log the error code only, not credentials.

### 2.8 Uploads / storage

- Scope: branding assets only (logo, favicon source, login artwork). No user-uploaded *documents* in v1.
- Bucket `branding`, **public read** (it's logos), writes **admin-only** via RLS on `storage.objects` (`is_admin()`).
- Types: `image/png`, `image/webp`, sanitized `image/svg+xml` only (SVG sanitized with the §2.7 allowlist + no `foreignObject`; rasterized if sanitization fails).
- Size cap **2 MB** per file (enforced server-side, not just `accept=`).
- Filenames: `<crypto-random>.<ext>` — never user-supplied; originals kept in DB metadata.
- `Content-Type` set from sniffed bytes on serve; `nosniff` always on.
- Malware scanning (ClamAV) is **not** available free-tier — mitigated by type allowlist + sanitization + admin-only writes; flagged as accepted gap for pen-test review.

## 3. Audit logging

`public.audit_log` (append-only — no UPDATE/DELETE policies for any role; admin UI is read-only; service role only appends). Every event: `id, created_at, actor_id, actor_role, action, entity_type, entity_id, result, ip, user_agent, metadata jsonb`.

**Events (minimum set):**

| Category | Events |
|---|---|
| Auth | `auth.login.success` · `auth.login.failure` · `auth.login.lockout` · `auth.logout` · `auth.password.changed` · `auth.password.reset_issued` · `auth.temp_password.issued` · `auth.session.revoked_all` |
| Users (admin) | `user.create` · `user.role_change` · `user.deactivate` · `user.reactivate` · `user.unlock` · `user.reset_password` |
| Bookings | `booking.create` · `booking.update` · `booking.cancel` · `booking.move` · `booking.conflict_override` · `booking.checkin?` (if added) |
| Change requests | `request.create` · `request.approve` · `request.decline` · `request.cancel` · `request.expire` |
| Catalogue | `room.create|update|deactivate` · `category.create|update|delete` · `formation.create|update|cancel` · `client.create|update|archive` · `plan.*` |
| Settings & mail | `settings.update` · `mail.send|mail.reply|mail.inbox.reply` · `mail.images_load` · `mail.rate_limited` · `settings.mail.test` · `mail.test_failure` |
| Data out | `export.bookings|export.clients|export.audit|export.reports` |
| Admin / system | `audit.export` · `cron.expire_requests (count)` · `user.mcp?` n/a · `system.keepalive` (if ping added) |
| Security-relevant meta | `rls.denied` (server actions log the predicate failure) · `csrf.rejected` · `origin.mismatch` |

Retention: **≥ 12 months**, exported monthly (RUNBOOK §10/§9.5). Reading the audit log is itself audited (`audit.export`).

## 4. Data protection

- Client PII minimization: no national IDs, no payment data (out of scope), birthdays not collected. Phone/email of contacts, company names, formation attendance — that's the whole PII set.
- Encryption in transit: TLS everywhere (Vercel, Supabase, Hostinger). At rest: Supabase-managed (free tier = provider-managed disk encryption).
- Secrets never in git (`.env*` ignored — verify `git ls-files | grep env` in CI), never in the client bundle, never in logs (log scrubbing of `*_PASSWORD`, keys, tokens; error toasts show generic messages).
- Logging discipline: server actions log `action, actor, entity, result` — **never payload bodies** containing PII or secrets.
- Morocco data-protection (loi 09-08 / CNDP): data stays within Supabase-hosted region choice (confirm region = EU-West closest to Casablanca); breach with PII exposure → CNDP notification + affected-client notice per incident skeleton §7.

## 5. Secrets & configuration

- `.env.example` (committed) — names, scopes, safe placeholders only.
- Real values — Vercel env scopes (prod vars don't exist in preview scope) + 1Password vault for break-glass.
- `SUPABASE_SERVICE_ROLE_KEY`: §2.2/RUNBOOK §9.6 — server-only, rotated on suspicion.
- `CRON_SECRET`: random ≥ 32 bytes; rotated on suspicion; sent only as bearer to `/api/cron/*`.
- SMTP/IMAP creds: mailbox password; rotation cadence — every 180 days or on personnel change.
- Access review: quarterly — who has Vercel/Supabase/Hostinger/1Password access; offboarding removes within 24h.

## 6. Incident response (skeleton)

```
DETECT → TRIAGE → CONTAIN → ERADICATE → RECOVER → NOTIFY → POST-MORTEM
```

- **P1** (data breach, mailbox loss, service-key leak, live phishing from contact@): page immediately (phone) + mail security@eiden-group.com; contain first (revoke key §RUNBOOK 9.6, global session revoke, disable mail integration if needed), then analyze.
- **P2** (service down > 15 min, auth broken, RLS misconfig with no confirmed exfil): contact@ group, fix-forward, same-day comms.
- **P3** (single user locked, cosmetic mail glitch): normal queue.
- Steps: snapshot evidence (logs, audit export) → contain → eradicate (rotate, patch, redeploy) → recover (verify service, restore from §RUNBOOK 9.5 if needed) → notify (leadership; CNDP ≤ 72h for PII breach; affected clients if applicable) → **blameless post-mortem ≤ 5 days** filed in `docs/incidents/YYYY-MM-DD-slug.md` with timeline and follow-up tickets.
- Owner: Security Engineer + Orchestrator. Every P1/P2 gets a post-mortem; P3s are logged in weekly review.

## 7. Dependency management

- **Dependabot**: weekly PRs (npm), grouped (patch/minor); security updates as they land.
- **CI gate**: `npm audit --omit=dev --audit-level=high` fails the build on high/critical runtime-dep advisories; moderate → review within 2 weeks.
- Lockfile committed; `npm ci` in CI; no `npm install` drift.
- Before adding a dependency: justify in PR (what it replaces, maintenance signal, license = MIT/Apache-2.0/BSD preferred; **copyleft rejected**); prefer native platform/stdlib; agents may not add deps without Architecture + Security sign-off.
- Next.js/Supabase/imapflow/nodemailer pinned to semver ranges with lockfile; framework upgrades are scheduled work, not drive-bys.

## 8. Pen-test checklist (run before launch & after major auth/mail changes)

- [ ] Login: brute-force lockout triggers at 5; no account-enumeration differential; recovery flow doesn't leak existence.
- [ ] Every Server Action: called with no session → rejected; with staff session against admin action → rejected; with another user's `entity_id` → RLS denial, no data leaked.
- [ ] IDOR sweep on bookings/requests/clients/formations/exports via UUIDs of other org "rows" (use seeded fixtures).
- [ ] CSRF: forged cross-origin POST → 403; cookie SameSite verified in browser.
- [ ] XSS: mail fixture corpus (script tags, event handlers, `javascript:` hrefs, `srcdoc` tricks, CSS `url()` exfil, oversized `style` attrs) → all inert; iframe cannot be escaped; images blocked by default.
- [ ] Attachments: `.svg` with script (forced download), `.png` with HTML payload (sniff), path-traversal filename (`../../`), 30 MB file (cap), `exe` (never inline).
- [ ] CSP: scan with securityheaders.com / Mozilla Observatory — target A; `x-frame-options` DENY; no mixed content.
- [ ] Rate limits: hammer login/mail/refresh/export — 429s observed; limits shared across instances (verify from two IPs/regions).
- [ ] Headers: nosniff, Referrer-Policy, Permissions-Policy present on `/`, `/login`, `/api/*`.
- [ ] Audit: every mutation above appears in `audit_log` with actor+result; no secrets in metadata payload.
- [ ] Service key absent: grep build output, client bundles, error pages for the key pattern / `service_role`; `NEXT_PUBLIC_*` list audited.
- [ ] `npm audit` clean (high/critical); Dependabot alerts at zero or triaged with notes.
- [ ] Password change revokes all sessions; deactivated user's cookies die.
- [ ] Staging seeded with hostile fixtures; findings disclosed responsibly per §6, fixes verified by re-test.

## 9. Change management

Security-relevant changes (auth, RLS, headers, mail, uploads, rate limits, audit events) require: Security Engineer review + this document updated **in the same PR**. New table → RLS + policies + docs/AGENTS.md impact in the same migration PR. No exceptions without Eiden Group leadership sign-off in the PR description.
