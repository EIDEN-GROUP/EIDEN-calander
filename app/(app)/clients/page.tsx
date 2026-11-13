import { connection } from "next/server";
import type { Metadata } from "next";
import { ClientsClient } from "@/components/clients/ClientsClient";

export const metadata: Metadata = { title: "Clients" };
export const instant = false;

export default async function ClientsPage() {
  // "Latest booking" derives from demo bookings anchored to "now".
  await connection();
  return <ClientsClient />;
}
