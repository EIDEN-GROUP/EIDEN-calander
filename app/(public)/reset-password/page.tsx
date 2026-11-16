import { connection } from "next/server";
import type { Metadata } from "next";
import ResetPasswordClient from "@/components/auth/ResetPasswordClient";

export const metadata: Metadata = { title: "Reset-password" };
// Reads request-time auth state (recovery hash): block prerender.
export const instant = false;

export default async function Page() {
  await connection();
  return <ResetPasswordClient />;
}
