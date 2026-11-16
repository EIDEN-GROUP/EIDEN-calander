# CALENDAR. · Security

Security posture for **CALENDAR.** (Eiden Group internal scheduling). Audience: engineers, reviewers, incident responders. Operational procedures (rotations, restores): docs/RUNBOOK.md. Data-access conventions: docs/ARCHITECTURE.md §7.

## 1. Threat model (summary)

**What we are.** An internal, single-tenant business app behind authentication. No public content, no self-signup, no OAuth. Users are Eiden Group staff; two roles: `admin`, `staff`. Shared workspace: staff see all rooms/bookings/clients/formations.

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
| Credential theft / password reuse | Phishing, stuffing | Supabase Auth; forced temp-password change; no OAuth surface. Brute-force throttling is project-configured in Supabase, not enforced in app code |
| Privilege escalation staff→admin | Broken server-side checks, IDOR | `requireAdmin()` re-checks in every admin action + RLS default-deny backstop |
| IDOR (read/modify another user's data or change requests) | Guessed UUIDs, missing ownership predicates | RLS policies; server-side `where recipient_id = auth.uid()`-style scoping; UUID v4 PKs |
| XSS via rendered mail or user text | `makrich@eiden-group.com` mailbox is untrusted input | sanitize-html allowlist, sandboxed iframe, images off, output encoding |
| CSRF on mutations | Cross-site form POST | Framework-level Origin/Host enforcement for Server Actions (Next.js) + SameSite=Lax cookies |
| Session hijack | XSS/theft of cookies | httpOnly + Secure + SameSite=Lax, short-lived access tokens + refresh rotation |
| Service-key abuse | Key in client bundle / logs | server-only module, never `NEXT_PUBLIC_`, rotation runbook (RUNBOOK §9.6) |
| Mail abuse (send-as makrich@) | Compromised app account | In-app reply rate limit (30/10 min, per-instance, best effort), MAILBOX_ALLOWED boot-time guard |
| Supply chain | Malicious/typosquat dependency | Lockfile, `npm audit` in CI (non-blocking pre-launch), Dependabot not yet configured, minimal deps |
| Data exfil via exports | CSV exports of on-screen data; workspace JSON export | Export is what the UI can query, shown to the requester only; workspace export is admin-only and audited (`workspace.export`) |
| Physical/verbal (shared office) | Screen glances | No app-level idle timeout yet (accepted gap, §2.3); clean-desk reminder: process, not code |

**Non-goals / accepted risks (documented, not hidden).**

- **No PITR** (Supabase free tier) → 7-day RPO, weekly `pg_dump`. Accepted by leadership until paid tier.
- **Shared workspace**: no per-room or per-client ACL between staff. Accepted: it is a deliberate product decision.
- **Mailbox compromise = total mailbox compromise** for `makrich@eiden-group.com`. We mitigate by making it a dedicated operational mailbox, not personal mail.
- **CSP: none deployed yet.** `next.config.ts` deliberately defers it (it needs per-request nonces to work with Next's inline runtime); see the comment there. This is the biggest open gap versus a typical hardened posture: accepted until then.
- **No app-level idle timeout**: sessions ride on short-lived access tokens (refresh rotation) plus app-side `is_active` re-checks on every action; see §2.3.
- Static-analysis/lint can't prove absence of logic flaws: see §8 pen-test checklist.

## 2. Control inventory

### 2.1 AuthN: Supabase email + password only

- **No OAuth, no magic links, no SSO**: email+password exclusively, by product decision.
- **No public sign-up**; accounts are created by admins. `must_change_password` forces a change on first login.
- **Self-service reset exists** at `/forgot-password`: the response is identical for known and unknown emails (no enumeration), the link is single-use and expires in 1 hour, and a password change revokes the user's other sessions (`signOut({ scope: "others" })`).
- Temp passwords: 14 random chars for admin-provisioned accounts (16 for the bootstrap script), `must_change_password = true`. Shown once to the admin at creation; the welcome email sends the same password to the new user (unless the `welcome` notification pref is off). The bootstrap script (`scripts/create-admin.mjs`) prints its password once to stdout and sends no email at all.
- Password policy: minimum **10 chars**, at least one letter and one number; enforced server-side in `changePasswordAction` (the client mirrors it). The strength meter on the profile page is a local 4-point heuristic, not zxcvbn (deferred).
- Email confirmation: not required (admin-verified provisioning instead).

### 2.2 AuthZ: RLS default-deny + server re-checks

- Every table: `rowsecurity = on`, zero public policies by default.
- `is_admin()`: security-definer function returning `exists(select 1 from profiles where id = auth.uid() and role = 'admin' and is_active)`; used by admin policies; `set search_path = public` to avoid search-path hijack.
- Staff-scoped policies (own notifications, own sent change requests, profile self-read) key on `auth.uid()`.
- **Every Server Action and route handler re-checks**: `requireUser()` (session valid) → `requireAdmin()` where applicable. RLS is the backstop: the app must be correct even if a policy is later miswritten.
- Storage bucket (`brand-assets`, logos only): RLS on `storage.objects`; public read, admin-only writes via `is_admin()`.

### 2.3 Sessions

- Supabase SSR cookies: `httpOnly`, `Secure` (prod), `SameSite=Lax`, path `/`.
- Access token short-lived (default 1h); refresh token rotation enabled in the project settings.
- Middleware (`proxy.ts`) refreshes the session cookie on every request; unauthenticated requests to app routes bounce to `/login` (API routes get 401 JSON instead).
- Changing your own password revokes your **other** sessions (`signOut({ scope: "others" })`). Deactivating a user sets `is_active = false` and bans the Supabase Auth user (`876600h`); the app re-checks `is_active` on every authenticated request, so a deactivated user's existing tokens stop working app-side immediately. No global session revocation for admin resets yet.
- **No app-level idle timeout.** Nothing signs you out after N minutes of inactivity. Accepted gap: rely on short-lived access tokens + refresh rotation, and on deactivation for offboarding. A warning toast at 25 min remains unbuilt.

### 2.4 CSRF

- Server Actions get Origin/Host enforcement from the framework (Next.js rejects action POSTs whose `Origin` doesn't match the host). Route handlers that mutate (cron) require the bearer secret instead of a session.
- `SameSite=Lax` cookies mean cross-site POSTs carry no session cookie anyway.
- There is no app-level `Origin`/`Sec-Fetch-Site` middleware; protection comes from the framework + cookie policy.

### 2.5 Rate limits & throttling

What is actually implemented today:

| Endpoint / action | Limit | Enforcement |
|---|---|---|
| Reply (`POST /api/mail/reply`) | **30 replies / 10 min per user** | In-memory token window in `lib/mail/rate-limit.ts`; **per-instance**, lost on restart; returns 429 + `Retry-After`. Best effort, not a hard boundary |
| Cron (`/api/cron/expire-requests`) | `CRON_SECRET` bearer | 401 otherwise |
| Supabase Auth endpoints | Per Supabase project config | Not in app code; configure and verify in the Supabase dashboard |

Everything else claimed elsewhere (login lockout thresholds, change-request and provisioning limits, export caps, Postgres-backed counters) is **not built**. Limits are not shared across serverless instances. Treat rate limiting as best-effort abuse damping, not as a security boundary; the SMTP layer authenticates as the mailbox owner, so abuse is limited to authenticated staff.

### 2.6 HTTP security headers

Set in `next.config.ts` (`headers()`) for all routes: actual values:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-DNS-Prefetch-Control: on
```

**No CSP and no HSTS are deployed.** The config file defers CSP deliberately (it needs nonces for Next's inline runtime; see the comment there), and HSTS belongs at the edge once TLS behavior is verified on the custom domain. `X-Frame-Options: DENY` covers clickjacking for legacy browsers, but there is no `frame-ancestors` fallback via CSP.

The mail iframe uses `sandbox="allow-same-origin"` **without** `allow-scripts`, so no script in a rendered message executes; the srcDoc content is additionally sanitized. (This is weaker than `sandbox=""`; the sanitizer and the absence of `allow-scripts` are what stand between mail HTML and script execution, not the sandbox attribute alone.)

### 2.7 Mail-specific controls (the highest-risk surface)

`makrich@eiden-group.com` is operated by the app and rendered in the browser. Treat every byte of it as hostile.

1. **IMAP over TLS only**: port 993; no 143, no STARTTLS fallback in app config. Cert validation enforced by imapflow.
2. **`MAILBOX_ALLOWED`**: an env var that must equal `IMAP_USER` (case-insensitive); the mail module throws at import time otherwise. The mail layer takes no mailbox parameter from callers, so no request can aim it at another mailbox.
3. **HTML sanitization**: all rendered message bodies pass through `sanitize-html` with an allowlist: `p, br, strong, em, u, s, a[href mailto/http(s) only], ul, ol, li, blockquote, table, thead, tbody, tr, th, td, img[src https? only]`; **no** `script, iframe, object, embed, form, input, style, link, meta, base`; all `on*` attributes stripped; `href` limited to `http/https/mailto`, auto-`rel="noopener noreferrer nofollow"` + `target="_blank"`; `style` attribute stripped or property-allowlisted (no `position`, `url()`, `expression()`).
4. **Images off by default**: remote images never auto-load; a per-message "Show remote content" toggle renders via the sanitized doc; `data:`/`blob:` imgs stripped. The toggle is not audited yet (`mail.images_load` unwired).
5. **Sandboxed iframe**: body renders into `<iframe sandbox="allow-same-origin" srcDoc={sanitized}>`. **No `allow-scripts`**, so no script executes; no forms; the parent never reaches into its DOM.
6. **Attachments**: **every** attachment is force-downloaded (never inline): `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`; size cap **25 MB** (413 beyond it, enforced while streaming); filename base-name only, `[\r\n/\\]` stripped; `part` must be a numeric dotted identifier; inline body parts are refused. Content is NOT magic-byte sniffed: the force-download + nosniff posture stands in for sniffing.
7. **No delete / no move**: the app cannot delete or move messages/mailbox folders. Hostinger's webmail is the source of truth; a bug or a malicious staff member cannot destroy mail via the app. (Allowed writes: `\Seen` flag only.)
8. **Reply security**: replies quote a plain-text excerpt of the original (HTML stripped by the sanitizer); reply-to comes from the parsed `From:` header (validated; CR/LF stripped); spoofed `From` display names are shown verbatim but never trusted (address is authoritative).
9. **Message bodies are fetched on demand** from IMAP and rendered via `srcDoc`, never stored in Postgres. Bodies are buffered in memory without an app-level size cap (accepted gap; the provider's own limits apply). Only the first 4 text parts are decoded.
10. **Headers of outbound mail**: app sets `Message-ID`, `Date`, proper `In-Reply-To`; DKIM/SPF alignment with the `makrich@eiden-group.com` mailbox per Hostinger config; no `Bcc` injection: recipients only from the reply flow.
11. **Mailbox credentials** (`IMAP_PASSWORD`/`SMTP_PASSWORD`) are server-only env, never sent to the client, never logged; failures log the error code only, not credentials.

### 2.8 Uploads / storage

- Scope: the logo in Settings → General is the only upload surface. No user-uploaded *documents* in v1.
- Bucket `brand-assets`, **public read** (it's logos), writes **admin-only** via RLS on `storage.objects` (`is_admin()`). Created in `supabase/migrations/0008_notification_prefs_locale_brand.sql` with no server-side `file_size_limit`/`allowed_mime_types` set on the bucket itself.
- Types allowed by the **client**: `image/svg+xml`, `image/png`, `image/webp`; 2 MB cap checked client-side. These are client-side checks only: nothing in the bucket policy or a route handler enforces them (accepted gap).
- **SVG is not sanitized.** Files go straight from the browser to the bucket and are served raw from the public URL. A crafted SVG could carry script; treat logo uploads as trusted-admin-only input (writes are admin-gated). Sanitizing or rasterizing SVGs before serving is the right fix (own PR).
- Filenames: `logo-<epoch ms>.<ext>`, generated client-side; `<ext>` is taken from the uploaded file's extension, not allowlisted.
- Type/size/extension validation on the live path is UX, not a security boundary. The boundary is "admin-only writes to a public-read bucket".
- Malware scanning (ClamAV) is **not** available free-tier: accepted gap for pen-test review.

## 3. Audit logging

`public.audit_log` (append-only: no INSERT/UPDATE/DELETE policies for any authenticated role; admin UI is read-only; writes go through the security-definer `log_audit_event()` RPC or the service role). Actual columns: `id, actor_id, action, entity_type, entity_id, meta jsonb, ip, created_at` (no actor_role, result, or user_agent).

**Events wired today** (grep `logAudit`/`log_audit_event`): `settings.business` · `settings.working_hours` · `settings.localization` · `settings.notification_prefs` · `settings.logo` · `room.create|update|toggle` · `category.create|update|delete|toggle` · `user.create` · `user.update` · `auth.password_change` · `workspace.export` · `client.create` · `client.anonymize` · `booking.create|update|postpone|delete` · `change_request.create|approve|decline|cancel` · `plan.create|status|delete` · `formation.create` · `formation.participant_remove`.

**Not yet wired** (planned minimum): `auth.login.*`, `auth.logout`, `user.deactivate|reactivate|unlock|reset_password`, `booking.move|cancel` (a cancellation is logged as `booking.delete`), `mail.*` (mail routes do not audit at all today), `settings.mail.test`, `cron.expire_requests`, `rls.denied`/`csrf.rejected`/`origin.mismatch` (meta-events).

This table is a target minimum, not an inventory; verify per-route coverage in the pen-test checklist (§8) rather than assuming it from here.

Retention: **≥ 12 months** (policy), exported monthly (RUNBOOK §10/§9.5). The spec says reading the log is itself audited (`audit.export`); not yet wired: today admins can read the log, and reads are not logged.

## 4. Data protection

- Client PII minimization: no national IDs, no payment data (out of scope), birthdays not collected. Phone/email of contacts, company names, formation attendance: that's the whole PII set.
- Encryption in transit: TLS everywhere (Vercel, Supabase, Hostinger). At rest: Supabase-managed (free tier = provider-managed disk encryption).
- Secrets never in git (`.env*` is gitignored; CI does not currently grep for it, verify by review), never in the client bundle, never in logs (log scrubbing of `*_PASSWORD`, keys, tokens; error toasts show generic messages).
- Logging discipline: server actions log `action, actor, entity, result`: **never payload bodies** containing PII or secrets.
- Morocco data-protection (loi 09-08 / CNDP): data stays within Supabase-hosted region choice (confirm region = EU-West closest to Casablanca); breach with PII exposure → CNDP notification + affected-client notice per incident skeleton §6.

## 5. Secrets & configuration

- `.env.example` (committed): names, scopes, safe placeholders only.
- Real values: Vercel env scopes (prod vars don't exist in preview scope) + 1Password vault for break-glass.
- `SUPABASE_SERVICE_ROLE_KEY`: §2.2/RUNBOOK §9.6: server-only, rotated on suspicion.
- `CRON_SECRET`: random ≥ 32 bytes; rotated on suspicion; sent only as bearer to `/api/cron/*`.
- SMTP/IMAP creds: mailbox password; rotation cadence: every 180 days or on personnel change.
- Access review: quarterly: who has Vercel/Supabase/Hostinger/1Password access; offboarding removes within 24h.

## 6. Incident response (skeleton)

```
DETECT → TRIAGE → CONTAIN → ERADICATE → RECOVER → NOTIFY → POST-MORTEM
```

- **P1** (data breach, mailbox loss, service-key leak, live phishing from the mailbox): page immediately (phone) + mail security@eiden-group.com; contain first (revoke key §RUNBOOK 9.6, revoke refresh tokens from the Supabase dashboard, disable mail integration if needed), then analyze.
- **P2** (service down > 15 min, auth broken, RLS misconfig with no confirmed exfil): notify security@eiden-group.com + Eiden Group leadership, fix-forward, same-day comms.
- **P3** (single user locked, cosmetic mail glitch): normal queue.
- Steps: snapshot evidence (logs, audit export) → contain → eradicate (rotate, patch, redeploy) → recover (verify service, restore from §RUNBOOK 9.5 if needed) → notify (leadership; CNDP ≤ 72h for PII breach; affected clients if applicable) → **blameless post-mortem ≤ 5 days** filed in `docs/incidents/YYYY-MM-DD-slug.md` with timeline and follow-up tickets.
- Owner: Security Engineer + Orchestrator. Every P1/P2 gets a post-mortem; P3s are logged in weekly review.

## 7. Dependency management

- **CI gate**: `npm audit --audit-level=high` runs in CI but is **non-blocking** pre-launch (`|| echo` warning, see `.github/workflows/ci.yml`). High/critical advisories must be triaged by hand until that flips to blocking. Moderate → review within 2 weeks.
- **Dependabot is not configured** (no `.github/dependabot.yml`). Add it, or run `npm audit` weekly manually.
- Lockfile committed; `npm ci` in CI; no `npm install` drift.
- Before adding a dependency: justify in PR (what it replaces, maintenance signal, license = MIT/Apache-2.0/BSD preferred; **copyleft rejected**); prefer native platform/stdlib; agents may not add deps without Architecture + Security sign-off.
- Next.js/Supabase/imapflow/nodemailer pinned to semver ranges with lockfile; framework upgrades are scheduled work, not drive-bys.

## 8. Pen-test checklist (run before launch & after major auth/mail changes)

- [ ] Login: no account-enumeration differential (generic error); recovery flow doesn't leak existence (identical response); Supabase dashboard Auth settings (throttles) reviewed and documented.
- [ ] Every Server Action: called with no session → rejected; with staff session against admin action → rejected; with another user's `entity_id` → RLS denial, no data leaked.
- [ ] IDOR sweep on bookings/requests/clients/formations/exports via UUIDs of other org "rows" (use seeded fixtures).
- [ ] CSRF: forged cross-origin POST → rejected (framework Origin/Host enforcement); cookie SameSite verified in browser.
- [ ] XSS: mail fixture corpus (script tags, event handlers, `javascript:` hrefs, `srcdoc` tricks, CSS `url()` exfil, oversized `style` attrs) → all inert; iframe cannot be escaped; images blocked by default.
- [ ] Attachments: `.svg` with script (forced download), `.png` with HTML payload (sniff), path-traversal filename (`../../`), file over the 25 MB cap, `exe` (never inline).
- [ ] CSP: scan with securityheaders.com / Mozilla Observatory: target A; `x-frame-options` DENY; no mixed content.
- [ ] Rate limits: reply 429s observed with `Retry-After`; confirmed the limiter is per-instance; login/provisioning/export limits N/A until built.
- [ ] Headers: nosniff, Referrer-Policy, Permissions-Policy present on `/`, `/login`, `/api/*`.
- [ ] Audit: every wired mutation appears in `audit_log`; no secrets in `meta` payload.
- [ ] Service key absent: grep build output, client bundles, error pages for the key pattern / `service_role`; `NEXT_PUBLIC_*` list audited.
- [ ] `npm audit` clean (high/critical) or triaged with notes; Dependabot configured (it is not today).
- [ ] Password change revokes other sessions (`scope: "others"`); deactivated user's existing session stops working at next request (proxy is_active gate).
- [ ] Staging seeded with hostile fixtures; findings disclosed responsibly per §6, fixes verified by re-test.

## 9. Change management

Security-relevant changes (auth, RLS, headers, mail, uploads, rate limits, audit events) require: Security Engineer review + this document updated **in the same PR**. New table → RLS + policies + docs/AGENTS.md impact in the same migration PR. No exceptions without Eiden Group leadership sign-off in the PR description.
