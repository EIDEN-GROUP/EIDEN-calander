# Server Actions: `app/actions/*`

All mutations go through typed Server Actions (Next 16). Conventions:

- **Auth**: every action re-resolves the session via `lib/auth.ts` (`requireUser` / `requireAdmin`). RLS is the backstop, never the only check. Unauthenticated → `AuthError` → action fails closed.
- **Env-guard**: when Supabase isn't configured (fresh clone), actions return `{ ok:false, error:{ code:"not_configured" } }` instead of throwing: the UI renders demo preview.
- **Return shape**: `ActionResult<T> = { ok:true, data:T } | { ok:false, error:{ code, message } }` from `lib/types/db.ts`. UI switches on `error.code` for special cases (`room_conflict`, `duplicate`, `validation`…).
- **Validation**: zod v4 schemas at the boundary; dates as ISO strings; UUIDs checked for path/action inputs.
- **Audit**: privileged/security-relevant mutations write `audit_log` (best-effort after the business write; a logging failure never rolls back the mutation).
- **Revalidation**: `revalidatePath` for `/calendar`, `/dashboard`, and the module route on every mutation.
- **Never**: service-role client except `createTeamUserAction`/ban toggle (server-only, admin-only, key from env).

## Files
| File | Actions |
|---|---|
| `bookings.ts` | `createBookingAction` (returns `conflict{clashes, suggestions}` when the room is taken: **does not save**), `requestChangeAction` (saves `pending_conflict` + opens change request + notifies incumbent), `respondToChangeRequestAction` (approve = guided move of incumbent + confirm requester's booking / decline = cancel it), `cancelChangeRequestAction`, `cancelBookingAction`, `listBookingsAction` (calendar live data), `markNotificationsReadAction` |
| `formations.ts` | `createFormationAction`, `enrollParticipantAction` (auto-waitlist at capacity), `markAttendanceAction`, `importParticipantsAction` (CSV bulk, duplicate-email skip) |
| `clients.ts` | `createClientAction` (duplicate email/phone detection → `{duplicate}`), `addClientNoteAction` (timestamped append), `anonymizeClientAction` (admin, type-name-confirm) |
| `plans.ts` | `createPlanAction`, `updatePlanStatusAction`, `addPlanTaskAction`, `cyclePlanTaskAction`, `deletePlanTaskAction`, `deletePlanAction` (admin) |
| `settings.ts` | `updateBusinessProfileAction`, `updateWorkingHoursAction`, `createRoomAction`, `toggleRoomActiveAction`, `createCategoryAction`, `createTeamUserAction` (service role: `auth.admin.createUser` + `profiles` upsert + one-time temp password), `setTeamUserActiveAction` (last-admin guard + ban), `testMailConnectionAction` (SMTP verify / IMAP connect, admin-only, latency), `listAuditLogAction` |
| `profile.ts` | `updateProfileAction`, `changePasswordAction` (re-verify current → update → `signOut({scope:'others'})`) |

## Demo-mode wiring status
Pages load live data server-side (`lib/live-data.ts` and the other `*-live.ts` loaders) and pass it down; when Supabase is unconfigured or unreachable they fall back to the bundled demo dataset (`lib/demo-data.ts`, `lib/mail/demo-messages.ts`) and the demo banner/labels render. Server Actions listed above are the live path and are wired into the UI.

Three `TODO(WIRE)` markers remain, none of them data-wiring: edge/Upstash rate limiting for replies/preview sends (`app/api/mail/reply/route.ts`, `lib/mail/rate-limit.ts`) and server-side dedup for bulk participant import (`components/formations/FormationDetailClient.tsx`).

## Wiring order (done, kept for history)
The original wiring plan, kept as a historical record of the build sequence:
1. `calendar/page.tsx` → `listBookingsAction` + `createBookingAction` (conflict modal) + `requestChangeAction`
2. `requests/[id]` → fetch change_request + `respondToChangeRequestAction` / `cancelChangeRequestAction`
3. `formations/[id]` → fetch participants + `enrollParticipantAction` / CSV import via `importParticipantsAction`
4. `settings/*` → list/mutate via `app/actions/settings.ts`
5. Notifications bell → `notifications` table (in-app writes landed via `notify_user()` RPC; no Realtime subscription is wired: the bell counts at load)

1–4 and the notification writes landed; the Realtime half of 5 did not.
