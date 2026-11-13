/**
 * Client view-model helpers — shared by the list and the detail page.
 */

import { getDemoBookings } from "@/lib/demo-data";
import { hashString } from "@/components/formations/Avatar";
import type { BookingRow, ClientRow } from "@/lib/types/db";

export type ClientStatusFilter = "all" | "lead" | "active" | "inactive";
export type ClientSort = "recent" | "name-asc" | "name-desc";

/**
 * "Latest booking" for a client: the demo booking nearest to today by
 * absolute distance; degrades to a deterministic pseudo-activity date when
 * the client has no bookings (stable across renders — hash of the id).
 */
export function latestBookingFor(clientId: string): { booking: BookingRow | null; at: Date } {
  const bookings = getDemoBookings().filter((b) => b.client_id === clientId);
  if (bookings.length > 0) {
    const now = Date.now();
    const nearest = bookings.reduce((best, current) =>
      Math.abs(new Date(current.starts_at).getTime() - now) <
      Math.abs(new Date(best.starts_at).getTime() - now)
        ? current
        : best,
    );
    return { booking: nearest, at: new Date(nearest.starts_at) };
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - (4 + (hashString(clientId) % 55)));
  return { booking: null, at: fallback };
}

export function sortClients(clients: ClientRow[], sort: ClientSort): ClientRow[] {
  const withActivity = clients.map((client) => ({ client, at: latestBookingFor(client.id).at.getTime() }));
  if (sort === "name-asc" || sort === "name-desc") {
    const factor = sort === "name-asc" ? 1 : -1;
    return withActivity
      .sort((a, b) => factor * a.client.full_name.localeCompare(b.client.full_name, "en"))
      .map(({ client }) => client);
  }
  return withActivity.sort((a, b) => b.at - a.at).map(({ client }) => client);
}

export function filterClients(
  clients: ClientRow[],
  query: string,
  status: ClientStatusFilter,
  tags: string[],
): ClientRow[] {
  const q = query.trim().toLowerCase();
  return clients.filter((client) => {
    if (status !== "all" && client.status !== status) return false;
    if (tags.length > 0 && !tags.some((tag) => client.tags.includes(tag))) return false;
    if (q) {
      const haystack = [client.full_name, client.company ?? "", client.email ?? "", client.city ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

const shortDayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
export function formatShortDate(d: Date): string {
  return shortDayFmt.format(d);
}
