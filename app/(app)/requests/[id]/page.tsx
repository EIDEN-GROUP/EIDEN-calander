import type { Metadata } from "next";
import { connection } from "next/server";
import { RequestThread } from "@/components/bookings/RequestThread";

export const metadata: Metadata = { title: "Change request" };
// Time-dependent (72h countdown) — block prerender.
export const instant = false;

export default async function ChangeRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  return <RequestThread changeRequestId={id} serverNow={new Date().toISOString()} />;
}
