import { connection } from "next/server";
import type { Metadata } from "next";
import { FormationDetailClient } from "@/components/formations/FormationDetailClient";

export const metadata: Metadata = { title: "Formation" };
// Dynamic by formation id — block prerender.
export const instant = false;

export default async function FormationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <FormationDetailClient id={id} />;
}
