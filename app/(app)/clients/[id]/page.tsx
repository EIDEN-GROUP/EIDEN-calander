import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClientDetailClient } from "@/components/clients/ClientDetailClient";
import { loadClient } from "@/lib/clients-live";

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
  const live = await loadClient(id);
  if (!live && process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  return <ClientDetailClient id={id} data={live} />;
}
