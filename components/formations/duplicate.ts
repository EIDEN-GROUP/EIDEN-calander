/**
 * Duplicate-a-formation logic shared by the list card and the detail page.
 * New id, dates shifted +7 days, title suffixed " (copy)". Demo-only: persists
 * to sessionStorage so the copy survives navigation.
 *
 * Demo fallback only. Live duplication goes through createFormationAction (server), which generates the id.
 * booking cloning and participant-copy semantics.
 */

import type { BookingRow, FormationRow } from "@/lib/types/db";
import { appendStoredFormation } from "./store";
import type { FormationVM } from "./model";

export interface DuplicatedFormation {
  booking: BookingRow;
  formation: FormationRow;
}

export function duplicateFormation(vm: FormationVM): DuplicatedFormation {
  const start = new Date(vm.booking.starts_at);
  start.setDate(start.getDate() + 7);
  const end = new Date(vm.booking.ends_at);
  end.setDate(end.getDate() + 7);

  const id = `bk-local-${Date.now()}`;
  const booking: BookingRow = {
    ...vm.booking,
    id,
    title: `${vm.booking.title} (copy)`,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: "confirmed",
  };
  const formation: FormationRow = {
    ...vm.formation,
    booking_id: id,
    status: "open",
  };

  appendStoredFormation({ booking, formation });
  return { booking, formation };
}
