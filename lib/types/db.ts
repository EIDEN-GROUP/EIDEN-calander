/**
 * CALENDAR. — hand-written database row types (mirrors supabase/migrations).
 * Regenerate with `supabase gen types typescript` once a project exists:
 *   supabase gen types typescript --db-url $SUPABASE_DB_URL > lib/types/db.ts
 */

export type UserRole = "admin" | "staff";
export type BookingType = "standard" | "formation";
export type BookingStatus = "confirmed" | "pending_conflict" | "cancelled" | "completed";
export type RequestStatus = "pending" | "approved" | "declined" | "cancelled" | "expired";
export type ClientStatus = "lead" | "active" | "inactive";
export type ParticipantStatus = "enrolled" | "confirmed" | "attended" | "no_show" | "cancelled";
export type FormationStatus = "draft" | "open" | "full" | "ongoing" | "completed" | "cancelled";
export type PlanStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type PlanPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  locale: "en" | "fr";
}

export interface RoomRow {
  id: string;
  name: string;
  location: string;
  capacity: number;
  hourly_rate: number;
  currency: string;
  amenities: string[];
  is_active: boolean;
  sort: number;
  notes: string | null;
}

export interface CategoryRow {
  id: string;
  name_en: string;
  name_fr: string | null;
  color: string;
  icon: string;
  type: BookingType;
  is_system: boolean;
  is_active: boolean;
  sort: number;
}

export interface BookingRow {
  id: string;
  type: BookingType;
  title: string;
  category_id: string;
  room_id: string | null;
  client_id: string | null;
  created_by: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price: number | null;
  notes: string | null;
}

export interface FormationRow {
  booking_id: string;
  capacity: number;
  description: string | null;
  price_label: number | null;
  status: FormationStatus;
}

export interface FormationParticipantRow {
  id: string;
  booking_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  client_id: string | null;
  status: ParticipantStatus;
  waitlist: boolean;
  enrolled_at: string;
  checked_in_at: string | null;
}

export interface ClientRow {
  id: string;
  type: "person" | "company";
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tags: string[];
  status: ClientStatus;
  source: string | null;
  notes: string | null;
  anonymized_at: string | null;
  deleted_at: string | null;
}

export interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  status: PlanStatus;
  priority: PlanPriority;
  start_date: string | null;
  target_date: string | null;
  progress: number;
  target_date_marker: boolean;
}

export interface PlanTaskRow {
  id: string;
  plan_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  position: number;
  completed_at: string | null;
}

export interface ChangeRequestRow {
  id: string;
  new_booking_id: string;
  conflicting_booking_id: string;
  requested_by: string;
  assigned_to: string;
  message: string | null;
  suggested_slots: Array<{ starts_at: string; ends_at: string }>;
  status: RequestStatus;
  response_message: string | null;
  created_at: string;
  expires_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
