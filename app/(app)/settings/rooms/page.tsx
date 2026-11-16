import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoomsView } from "@/components/settings/views/RoomsView";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaRooms") };
}
export const instant = false;

type RoomVM = ComponentProps<typeof RoomsView> extends { initialRooms?: infer R } ? (R extends Array<infer V> ? V : never) : never;

export default async function RoomsPage() {
  await connection();
  let initialRooms: RoomVM[] | undefined;
  let live = false;
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase
      .from("rooms")
      .select("id,name,location,capacity,hourly_rate,currency,amenities,is_active,sort,notes")
      .order("sort");
    if (data) {
      initialRooms = data.map((r) => ({
        id: r.id as string,
        name: (r.name as string).replace(/\s*\(DEMO\)\s*$/, ""),
        location: (r.location as string) === "Agadir" ? "Agadir" : "Casablanca",
        capacity: Number(r.capacity),
        hourly_rate: Number(r.hourly_rate),
        amenities: Array.isArray(r.amenities) ? (r.amenities as string[]).filter((a) => ["wifi", "projector", "screen", "whiteboard", "videoconf", "parking"].includes(a)) : [],
        is_active: Boolean(r.is_active),
        notes: (r.notes as string | null) ?? "",
      })) as RoomVM[];
      live = true;
    }
  }
  return <RoomsView initialRooms={initialRooms} live={live} />;
}
