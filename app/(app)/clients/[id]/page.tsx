import { connection } from "next/server";
import type { Metadata } from "next";
import { ClientDetailClient } from "@/components/clients/ClientDetailClient";

export const metadata: Metadata = { title: "Client" };
// Dynamic by client id — block prerender.
export const instant = false;

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <ClientDetailClient id={id} />;
}
