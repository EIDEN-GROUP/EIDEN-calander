"use server";

import { getSessionProfile } from "@/lib/auth";

export interface ProfileSummary {
  fullName: string;
  role: "admin" | "staff";
  initials: string;
  email: string;
}

export async function getProfileSummaryAction(): Promise<ProfileSummary | null> {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const parts = profile.full_name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] ?? "E") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "");
  return {
    fullName: profile.full_name,
    role: profile.role,
    initials: initials.toUpperCase(),
    email: profile.email,
  };
}
