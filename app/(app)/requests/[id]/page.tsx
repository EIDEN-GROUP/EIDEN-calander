import { EmptyState } from "@/components/EmptyState";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Change request" };
// Dynamic by request id — block prerender.
export const instant = false;

export default function Page() {
  return (
    <EmptyState
      title="Change request"
      description="The negotiation thread between you and the incumbent booker — approve with the guided move, or decline with alternatives."
      phase="2"
    />
  );
}
