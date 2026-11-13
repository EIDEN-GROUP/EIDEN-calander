import type { Metadata } from "next";
import { RoomsView } from "@/components/settings/views/RoomsView";

export const metadata: Metadata = { title: "Rooms & Resources" };

export default function Page() {
  return <RoomsView />;
}
