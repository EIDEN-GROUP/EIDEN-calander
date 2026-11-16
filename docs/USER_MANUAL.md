# CALENDAR. · User manual
**For Eiden Group staff · English · Français (both shipped)**

CALENDAR. is our internal scheduling system. You do everything here: book meeting rooms, manage formations, keep client records, track plans and reports. There is no public sign-up: your administrator creates your account.

## Sign in
1. Go to **https://calendar.eiden-group.com** (or the URL your admin gave you).
2. Enter your **email** and **password**.
3. First time? Your admin created the account with a temporary password: you must set your own immediately.

**Forgot password?** Click "Forgot password?" and follow the link in the email. The link is single-use and lasts 1 hour.

**Wrong password 5 times?** The account locks for 15 minutes. Contact your admin if you are locked out repeatedly.

---

## Dashboard
Your overview for the day and the week: today's bookings, room utilization, formations fill rate, pending change requests at a glance.

- **Week strip**: tap a day to jump.
- **Room grid**: rooms across the week. Click any booking for details.
- **Quick actions**: New booking, new formation, add a client, new plan.
- The command palette (⌘K) can start a new booking from anywhere, and press N anywhere.

## Calendar
Day / Week / Month / Agenda views. Switch with the segmented control at the top right.

- **Drag on empty grid cells** to create a booking with those times.
- **Click a booking** to open it, or right-click it for the quick menu (Edit / Add / Postpone / Pause / Remove).
- Filter by room, location (Casa / Agadir) or category.
- Weekend columns are shaded; the red dot marks the current time.

### Double-booking (the core rule)
One room = one active booking at a time. If you try to book a room that's busy:

1. You'll see a **conflict warning** listing what's already there and **suggested free times**.
2. Tap a suggested slot, or ask the other booking's organizer to move: the system sends them a **change request**.
3. They approve or decline from their side; you get notified either way.
4. You can't create the conflicting booking; the room is protected.

**Remove** = the booking is deleted entirely (audit log keeps a record of who did it and when). **Pause** = booking on hold, room freed: resume anytime.

## Formations
- **Formations** tab lists all training sessions with capacity and fill-rate ring.
- Click one to manage: info (title, capacity, price label: no invoicing here) and **Participants** roster.
- **Enroll** one person, or **Import CSV** (headers: full_name, email, phone, company): we preview rows and flag duplicates before saving.
- **Attendance**: tap each name, or "Mark all present".
- Full sessions accept a **waitlist**: promote people when seats open.
- Print roster or export CSV from the header.
- Participants are **not** clients: clients are businesses/customers. You can link a participant to an existing client if helpful.

## Clients (CRM-lite)
Search, filter and sort; card or table view. Each client shows a timeline of bookings and notes.

- Tags with status badge: lead / active / inactive.
- Hover a card for quick actions: new booking for this client, enroll in a formation.
- Duplicate? The system offers a merge instead of creating two.
- Settings → Data & Privacy → **Anonymize** replaces personal data with redaction markers; bookings stay for reporting. Admins only.

## Plans
Strategic objectives with tasks and progress rings.

- Board (drag between columns) or list view.
- Task: title, assignee, due date, status; click to cycle todo → in progress → done.
- Progress is computed from tasks automatically; the ring updates live.
- Toggle "show on calendar" to surface the target date on the month view.

## Reports
- Date range (7D/30D/90D/Quarter) + location filter.
- Bookings per day, revenue by category, utilization by room, formation performance.
- **Export CSV**: downloads what's on screen.

## Inbox
**Eiden Group internal mailbox**: `makrich@eiden-group.com` rendered as a proper mail UI.
- Read, search, mark read/unread, reply.
- Your outbound mail is sent from the same address.
- No delete/move: the source of truth stays on Hostinger webmail.

## Notifications
- Bell in the top bar (or Settings → Notifications for email preferences).
- Change requests, booking updates, formation reminders, weekly digest.

## Settings (admins only)
- **General**: business name, legal entity, logo, timezone, currency.
- **Categories**: booking types shown everywhere (dropdowns, colors, icons). Formation category is one of them.
- **Rooms & Resources**: name, location (Casa/Agadir), capacity, hourly rate, amenities.
- **Working hours**: per weekday open/close and the global slot increment.
- **Team**: create/deactivate staff accounts. Temp passwords are shown **once** and emailed.
- **Notifications**: per-event email toggles; **Mail** tab tests the connection.
- **Audit log**: every change, who made it, when. Export CSV.
- **Security**: placeholder: today your password and sessions live on your profile.
- **Data & Privacy**: export workspace JSON, anonymize clients.

## Your profile
Name, phone, locale (EN/FR), password. Click your avatar top-right.

## Language
Toggle **EN/FR** in the top bar any time: your preference is remembered (stored in a cookie and on your profile).

## Keyboard shortcuts
| Keys | Action |
|---|---|
| `⌘K` or `Ctrl+K` | Command palette: jump anywhere, new booking, toggle EN/FR, sign out |
| `G` then `D` | Dashboard |
| `G` then `C` | Calendar |
| `G` then `F` | Formations |
| `G` then `P` | Plans |
| `G` then `R` | Reports |
| `G` then `I` | Inbox |
| `N` | New booking |
| `?` | Shortcut cheatsheet |
| `←` / `→` | Previous / next period on the calendar |
| `Esc` | Close the drawer, modal or palette |

## If something goes wrong
1. Refresh the page.
2. Sign out and back in.
3. Still broken? Tell your admin exactly what you clicked and what you expected: screenshots help. Include the time it happened (we keep an audit log and server logs).

## Cheat sheet
| I want to… | Do this |
|---|---|
| Book a room | + New booking → pick room, time, client → Save |
| Fix a conflict | Tap the conflict warning → pick a suggested slot, or request change |
| Cancel a booking | Right-click booking → Remove (kept in audit log) |
| Hold a booking | Right-click booking → Pause |
| Check my week | Dashboard week grid |
| Add a client | Clients → New client |
| Get paid | Ask your accountant: CALENDAR. tracks, it doesn't invoice |
| Change my password | Avatar → Profile → Security |
