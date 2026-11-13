import { connection } from "next/server";
import type { Metadata } from "next";
import { ClientsClient } from "@/components/clients/ClientsClient";
import { loadClients } from "@/lib/clients-live";

export const metadata: Metadata = { title: "Clients" };
export const instant = false;

export default async function ClientsPage() {
  await connection();
  const data = await loadClients();
  return <ClientsClient data={data} />;
}
