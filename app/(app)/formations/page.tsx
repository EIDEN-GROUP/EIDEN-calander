import { connection } from "next/server";
import type { Metadata } from "next";
import { FormationsClient } from "@/components/formations/FormationsClient";

export const metadata: Metadata = { title: "Formations" };
export const instant = false;

export default async function FormationsPage() {
  // Demo bookings are anchored to "now" — render at request time.
  await connection();
  return <FormationsClient />;
}
