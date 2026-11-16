/**
 * CALENDAR. · DEMO DATA (preview mode).
 * Used when Supabase isn't configured yet (.env missing). Every entity is
 * clearly labelled DEMO. Nothing here ships to production when a real
 * project is connected: pages prefer live data and fall back to this.
 */

import type {
  BookingRow,
  CategoryRow,
  ClientRow,
  FormationParticipantRow,
  FormationRow,
  PlanRow,
  PlanTaskRow,
  RoomRow,
} from "@/lib/types/db";

export const DEMO_ROOMS: RoomRow[] = [
  { id: "room-grande", name: "Salle Grande (DEMO)", location: "Casablanca", capacity: 12, hourly_rate: 450, currency: "MAD", amenities: ["wifi", "projector", "screen", "videoconf"], is_active: true, sort: 1, notes: null },
  { id: "room-petite", name: "Salle Petite (DEMO)", location: "Agadir", capacity: 6, hourly_rate: 250, currency: "MAD", amenities: ["wifi", "whiteboard"], is_active: true, sort: 2, notes: null },
  { id: "room-formation", name: "Salle Formation (DEMO)", location: "Casablanca", capacity: 20, hourly_rate: 600, currency: "MAD", amenities: ["wifi", "projector", "screen", "whiteboard", "videoconf"], is_active: true, sort: 3, notes: null },
];

export const DEMO_CATEGORIES: CategoryRow[] = [
  { id: "cat-room-rental", name_en: "Meeting Room Rental", name_fr: "Location de salle", color: "blue", icon: "door-open", type: "standard", is_system: true, is_active: true, sort: 1 },
  { id: "cat-formation", name_en: "Formation", name_fr: "Formation", color: "green", icon: "graduation-cap", type: "formation", is_system: true, is_active: true, sort: 2 },
  { id: "cat-event", name_en: "Event", name_fr: "Événement", color: "purple", icon: "sparkles", type: "standard", is_system: false, is_active: true, sort: 3 },
];

export const DEMO_CLIENTS: ClientRow[] = [
  { id: "cli-1", type: "company", full_name: "Acme SARL", company: "Acme SARL", email: "contact@acme.ma", phone: "+212 522 110 001", address: "Boulevard Zerktouni, Maarif", city: "Casablanca", tags: ["recurring", "boardroom"], status: "active", source: "referral", notes: "Monthly board meeting. Prefers mornings.", anonymized_at: null, deleted_at: null },
  { id: "cli-2", type: "company", full_name: "Attijariwafa Bank", company: "Attijariwafa Bank", email: "events@attijariwafa.ma", phone: "+212 522 290 000", address: "2 Bd Moulay Youssef", city: "Casablanca", tags: ["enterprise"], status: "active", source: "web", notes: null, anonymized_at: null, deleted_at: null },
  { id: "cli-3", type: "person", full_name: "Salma Bennani", company: null, email: "salma.bennani@gmail.com", phone: "+212 661 234 567", address: null, city: "Agadir", tags: ["training"], status: "active", source: "walk-in", notes: "Attends every React session.", anonymized_at: null, deleted_at: null },
  { id: "cli-4", type: "company", full_name: "Marjane Group", company: "Marjane Group", email: "pmo@marjane.ma", phone: "+212 537 750 000", address: "Bd Annakhil, Hay Riad", city: "Rabat", tags: ["committee"], status: "lead", source: "web", notes: "Quarterly committee, negotiating rate.", anonymized_at: null, deleted_at: null },
  { id: "cli-5", type: "person", full_name: "Yasmine Bouhlal", company: "Casablanca Tech Hub", email: "yasmine@casatech.ma", phone: "+212 600 111 222", address: null, city: "Casablanca", tags: ["trainer"], status: "active", source: "referral", notes: "Delivers React sessions for us.", anonymized_at: null, deleted_at: null },
  { id: "cli-6", type: "company", full_name: "ONCF", company: "ONCF", email: "events@oncf.ma", phone: "+212 537 769 300", address: "Av Allal Ben Abdellah", city: "Rabat", tags: ["enterprise", "recurring"], status: "active", source: "referral", notes: null, anonymized_at: null, deleted_at: null },
  { id: "cli-7", type: "person", full_name: "Karim Lazrak", company: null, email: "karim.lazrak@outlook.com", phone: "+212 655 888 999", address: null, city: "Agadir", tags: [], status: "lead", source: "web", notes: "Asked about formation pricing.", anonymized_at: null, deleted_at: null },
];

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Demo bookings around the current week. Ids stable. */
export function getDemoBookings(): BookingRow[] {
  return [
    { id: "bk-1", type: "standard", title: "Acme SARL · Board meeting", category_id: "cat-room-rental", room_id: "room-grande", client_id: "cli-1", created_by: "demo-admin", starts_at: at(-1, 9, 30), ends_at: at(-1, 11, 0), status: "completed", price: 675, notes: null },
    { id: "bk-2", type: "formation", title: "React Avancé · Session 3", category_id: "cat-formation", room_id: "room-formation", client_id: null, created_by: "demo-admin", starts_at: at(0, 14, 0), ends_at: at(0, 17, 0), status: "confirmed", price: null, notes: null },
    { id: "bk-3", type: "standard", title: "Attijariwafa · Events booth", category_id: "cat-room-rental", room_id: "room-petite", client_id: "cli-2", created_by: "demo-staff", starts_at: at(0, 16, 0), ends_at: at(0, 18, 0), status: "confirmed", price: 500, notes: null },
    { id: "bk-4", type: "standard", title: "Marjane · Quarterly committee", category_id: "cat-room-rental", room_id: "room-grande", client_id: "cli-4", created_by: "demo-staff", starts_at: at(1, 15, 30), ends_at: at(1, 17, 0), status: "confirmed", price: 675, notes: "They bring own coffee" },
    { id: "bk-5", type: "formation", title: "Formation Agile · Module 1", category_id: "cat-formation", room_id: "room-formation", client_id: null, created_by: "demo-admin", starts_at: at(1, 9, 30), ends_at: at(1, 13, 0), status: "confirmed", price: null, notes: null },
    { id: "bk-6", type: "standard", title: "ONCF · Steering committee", category_id: "cat-room-rental", room_id: "room-grande", client_id: "cli-6", created_by: "demo-admin", starts_at: at(3, 14, 0), ends_at: at(3, 16, 0), status: "confirmed", price: 900, notes: null },
    { id: "bk-7", type: "standard", title: "ONCF · Follow-up (overlap demo)", category_id: "cat-room-rental", room_id: "room-grande", client_id: "cli-6", created_by: "demo-staff", starts_at: at(3, 15, 0), ends_at: at(3, 17, 0), status: "pending_conflict", price: 900, notes: "Awaiting move of ONCF steering committee" },
    { id: "bk-8", type: "standard", title: "Revue produit · Équipe", category_id: "cat-event", room_id: "room-petite", client_id: null, created_by: "demo-admin", starts_at: at(0, 17, 30), ends_at: at(0, 18, 15), status: "confirmed", price: null, notes: null },
    { id: "bk-9", type: "standard", title: "Coworking · drop-in (DEMO)", category_id: "cat-event", room_id: "room-petite", client_id: null, created_by: "demo-staff", starts_at: at(5, 10, 30), ends_at: at(5, 12, 0), status: "confirmed", price: null, notes: null },
    { id: "bk-10", type: "standard", title: "Acme SARL · Audit review", category_id: "cat-room-rental", room_id: "room-grande", client_id: "cli-1", created_by: "demo-admin", starts_at: at(2, 9, 0), ends_at: at(2, 11, 0), status: "confirmed", price: 900, notes: null },
    { id: "bk-11", type: "formation", title: "React Avancé · Session 4", category_id: "cat-formation", room_id: "room-formation", client_id: null, created_by: "demo-admin", starts_at: at(4, 14, 0), ends_at: at(4, 17, 0), status: "confirmed", price: null, notes: "Full: waitlist active" },
    { id: "bk-12", type: "standard", title: "Salma · coaching", category_id: "cat-event", room_id: null, client_id: "cli-3", created_by: "demo-admin", starts_at: at(2, 16, 0), ends_at: at(2, 17, 0), status: "confirmed", price: null, notes: "Client's site" },
  ];
}

export const DEMO_FORMATIONS: FormationRow[] = [
  { booking_id: "bk-2", capacity: 20, description: "Hooks, RSC, data fetching, testing. Hands-on, bring your laptop.", price_label: 1200, status: "open" },
  { booking_id: "bk-5", capacity: 20, description: "Scrum, Kanban, retros; certification prep.", price_label: 900, status: "open" },
  { booking_id: "bk-11", capacity: 20, description: "Advanced patterns, performance, caching.", price_label: 1200, status: "full" },
];

export function getDemoParticipants(bookingId: string): FormationParticipantRow[] {
  const mk = (id: string, name: string, company: string | null, status: FormationParticipantRow["status"], waitlist = false): FormationParticipantRow => ({
    id, booking_id: bookingId, full_name: name, email: `${name.toLowerCase().replace(/[^a-z]/g, ".").replace(/\.+/g, ".")}@demo.ma`, phone: "+212 6 00 00 00 00", company, client_id: null, status, waitlist, enrolled_at: at(-7, 10), checked_in_at: status === "attended" ? at(0, 9, 25) : null,
  });
  if (bookingId === "bk-2") {
    return [
      mk("p-1", "Salma Bennani", null, "confirmed"),
      mk("p-2", "Omar Tazi", "Attijariwafa Bank", "attended"),
      mk("p-3", "Nadia Chraibi", "Marjane Group", "confirmed"),
      mk("p-4", "Youssef Amrani", "Acme SARL", "enrolled"),
      mk("p-5", "Leila Kabir", "Casablanca Tech Hub", "enrolled"),
      mk("p-6", "Mehdi Alaoui", null, "enrolled"),
    ];
  }
  if (bookingId === "bk-11") {
    return Array.from({ length: 20 }, (_, i) =>
      mk(`w-${i}`, `Participant ${i + 1}`, i % 3 === 0 ? "Acme SARL" : null, "confirmed"),
    ).concat([mk("w-wait-1", "Waitlisted W.", null, "enrolled", true)]);
  }
  return [mk("f5-1", "Karim Lazrak", null, "confirmed"), mk("f5-2", "Salma Bennani", null, "attended")];
}

export const DEMO_PLANS: PlanRow[] = [
  { id: "plan-1", title: "Open Salle Formation · March", description: "Equip and launch the training room.", owner_id: "demo-admin", status: "active", priority: "high", start_date: at(-30, 0).slice(0, 10), target_date: at(45, 0).slice(0, 10), progress: 67, target_date_marker: true },
  { id: "plan-2", title: "Agadir second location", description: "Negotiate lease, fit-out, hiring.", owner_id: "demo-admin", status: "planning", priority: "medium", start_date: null, target_date: at(120, 0).slice(0, 10), progress: 40, target_date_marker: true },
  { id: "plan-3", title: "Website + booking funnel", description: "Public site with lead capture.", owner_id: "demo-staff", status: "active", priority: "medium", start_date: at(-14, 0).slice(0, 10), target_date: at(30, 0).slice(0, 10), progress: 62, target_date_marker: false },
];

export const DEMO_PLAN_TASKS: PlanTaskRow[] = [
  { id: "t-1", plan_id: "plan-1", title: "Buy projector + screen", assignee_id: "demo-admin", due_date: at(-5, 0).slice(0, 10), status: "done", position: 1, completed_at: at(-5, 15) },
  { id: "t-2", plan_id: "plan-1", title: "Install wifi mesh", assignee_id: "demo-staff", due_date: at(-2, 0).slice(0, 10), status: "done", position: 2, completed_at: at(-2, 11) },
  { id: "t-3", plan_id: "plan-1", title: "Acoustic panels", assignee_id: "demo-staff", due_date: at(2, 0).slice(0, 10), status: "in_progress", position: 3, completed_at: null },
  { id: "t-4", plan_id: "plan-1", title: "Sign supplier contract", assignee_id: "demo-admin", due_date: at(6, 0).slice(0, 10), status: "todo", position: 4, completed_at: null },
  { id: "t-5", plan_id: "plan-1", title: "Soft launch with internal test", assignee_id: "demo-admin", due_date: at(14, 0).slice(0, 10), status: "todo", position: 5, completed_at: null },
  { id: "t-6", plan_id: "plan-2", title: "Shortlist 3 locations", assignee_id: "demo-admin", due_date: at(10, 0).slice(0, 10), status: "in_progress", position: 1, completed_at: null },
  { id: "t-7", plan_id: "plan-3", title: "Draft landing copy EN/FR", assignee_id: "demo-staff", due_date: at(-1, 0).slice(0, 10), status: "done", position: 1, completed_at: at(-1, 18) },
];

export const DEMO_NOTIFICATIONS = [
  { id: "n-1", user_id: "me", type: "change_request_received", title: "Yasmine asked to move Salle Grande", body: "Booking #ONCF · Tue 14:00 → she suggests 16:30", link: "/requests/demo", entity_id: null, read_at: null, created_at: at(0, 8, 15) },
  { id: "n-2", user_id: "me", type: "booking_created", title: "Formation Agile · Module 1 confirmed", body: "Tomorrow 09:30 · Salle Formation", link: "/calendar", entity_id: null, read_at: null, created_at: at(0, 7, 40) },
  { id: "n-3", user_id: "me", type: "formation_reminder", title: "React Avancé S4 is full", body: "20/20 · waitlist active (1 waiting)", link: "/formations/bk-11", entity_id: "bk-11", read_at: at(0, 9), created_at: at(-1, 18, 0) },
];

export const DEMO_CHANGE_REQUESTS = [
  { id: "cr-1", new_booking_id: "bk-7", conflicting_booking_id: "bk-6", requested_by: "demo-staff", assigned_to: "demo-admin", message: "Could we move ONCF steering to 16:30? Our slot must stay 14:00 for the client.", suggested_slots: [{ starts_at: at(3, 16, 30), ends_at: at(3, 18, 30) }], status: "pending" as const, response_message: null, created_at: at(0, 8, 10), expires_at: at(3, 0) },
  { id: "cr-2", new_booking_id: "bk-3", conflicting_booking_id: "bk-2", requested_by: "demo-admin", assigned_to: "demo-admin", message: "Client wants Petite for the expo booth. Can React S3 start 15:00 instead?", suggested_slots: [{ starts_at: at(0, 15, 0), ends_at: at(0, 18, 0) }], status: "approved" as const, response_message: "Moved to 15:00, done.", created_at: at(-1, 12), expires_at: at(2, 0) },
];
