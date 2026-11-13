import type { Metadata } from "next";
import { TeamView } from "@/components/settings/views/TeamView";

export const metadata: Metadata = { title: "Team & Users" };

export default function Page() {
  return <TeamView />;
}
