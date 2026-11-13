# Server Actions — `app/actions/*`

All mutations go through typed Server Actions (Next 16). Conventions:

- **Auth**: every action re-resolves the session via `lib/auth.ts` (`requireUser` / `requireAdmin`). RLS is the backstop, never the only check. Unauthenticated → `AuthError` → action fails closed.
- **Env-guard**: when Supabase isn't configured (fresh clone), actions return `{ ok:false, error:{ code:"not_configured" } }` instead of throwing — the UI renders demo preview.
- **Return shape**: `ActionResult<T> = { ok:true, data:T } | { ok:false, error:{ code, message } }` from `lib/types/db.ts`. UI switches on `error.code` for special cases (`room_conflict`, `duplicate`, `validation`…).
- **Validation**: zod v4 schemas at the boundary; dates as ISO strings; UUIDs checked for path/action inputs.
- **Audit**: privileged/security-relevant mutations write `audit_log` (best-effort after the business write; a logging failure never rolls back the mutation).
- **Revalidation**: `revalidatePath` for `/calendar`, `/dashboard`, and the module route on every mutation.
- **Never**: service-role client except `createTeamUserAction`/ban toggle (server-only, admin-only, key from env).

## Files
| File | Actions |
|---|---|
| `bookings.ts` | `createBookingAction` (returns `conflict{clashes, suggestions}` when the room is taken — **does not save**), `requestChangeAction` (saves `pending_conflict` + opens change request + notifies incumbent), `respondToChangeRequestAction` (approve = guided move of incumbent + confirm requester's booking / decline = cancel it), `cancelChangeRequestAction`, `cancelBookingAction`, `listBookingsAction` (calendar live data), `markNotificationsReadAction` |
| `formations.ts` | `createFormationAction`, `enrollParticipantAction` (auto-waitlist at capacity), `markAttendanceAction`, `importParticipantsAction` (CSV bulk, duplicate-email skip) |
| `clients.ts` | `createClientAction` (duplicate email/phone detection → `{duplicate}`), `addClientNoteAction` (timestamped append), `anonymizeClientAction` (admin, type-name-confirm) |
| `plans.ts` | `createPlanAction`, `updatePlanStatusAction`, `addPlanTaskAction`, `cyclePlanTaskAction`, `deletePlanTaskAction`, `deletePlanAction` (admin) |
| `settings.ts` | `updateBusinessProfileAction`, `updateWorkingHoursAction`, `createRoomAction`, `toggleRoomActiveAction`, `createCategoryAction`, `createTeamUserAction` (service role: `auth.admin.createUser` + `profiles` upsert + one-time temp password), `setTeamUserActiveAction` (last-admin guard + ban), `testMailConnectionAction` (SMTP verify / IMAP connect, admin-only, latency), `listAuditLogAction` |
| `profile.ts` | `updateProfileAction`, `changePasswordAction` (re-verify current → update → `signOut({scope:'others'})`) |

## Demo-mode wiring status
UI ships in **preview mode** (demo data from `lib/demo-data.ts` + local state) until the app is connected to Supabase (`.env`) and the wiring pass replaces demo state with `await action()` calls + `router.refresh()`. Search for `TODO(WIRE)` in the codebase for every seam.

## Wiring order (next session)
1. `calendar/page.tsx` → `listBookingsAction` + `createBookingAction` (conflict modal) + `requestChangeAction`
2. `requests/[id]` → fetch change_request + `respondToChangeRequestAction` / `cancelChangeRequestAction`
3. `formations/[id]` → fetch participants + `enrollParticipantAction` / CSV import via `importParticipantsAction`
4. `settings/*` → list/mutate via `app/actions/settings.ts`
5. Notifications bell → `notifications` table + Supabase Realtime
