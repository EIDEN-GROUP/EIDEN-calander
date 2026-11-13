import { connection } from "next/server";
import type { Metadata } from "next";
import { FormationsClient } from "@/components/formations/FormationsClient";
import { loadFormations } from "@/lib/formation-vms";

export const metadata: Metadata = { title: "Formations" };
export const instant = false;

export default async function FormationsPage() {
  await connection();
  const live = await loadFormations();
  return <FormationsClient data={live} />;
}
