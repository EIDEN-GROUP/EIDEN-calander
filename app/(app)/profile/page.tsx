import type { Metadata } from "next";
import { ProfileView } from "@/components/settings/views/ProfileView";

export const metadata: Metadata = { title: "Your profile" };

export default function Page() {
  return <ProfileView />;
}
