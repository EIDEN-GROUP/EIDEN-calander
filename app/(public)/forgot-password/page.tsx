import { connection } from "next/server";
import type { Metadata } from "next";
import ForgotPasswordClient from "@/components/auth/ForgotPasswordClient";

export const metadata: Metadata = { title: "Forgot-password" };
// Reads request-time auth state (recovery hash) — block prerender.
export const instant = false;

export default async function Page() {
  await connection();
  return <ForgotPasswordClient />;
}
