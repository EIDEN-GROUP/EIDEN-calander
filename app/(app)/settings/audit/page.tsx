import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { AuditView, type AuditEntryLive } from "@/components/settings/views/AuditView";
import { listAuditLogAction } from "@/app/actions/settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit Log · Settings" };

type Verb = "create" | "update" | "delete" | "auth" | "settings";

function toVerb(action: string): Verb {
  const tail = action.split(".").pop() ?? "";
  if (/create|insert|add|enroll|invite/.test(tail)) return "create";
  if (/delete|cancel|remove|anonymize|merge|deactivate/.test(tail)) return "delete";
  if (/^auth|login|password/.test(action)) return "auth";
  if (/^settings|category|room|working_hours/.test(action)) return "settings";
  return "update";
}

function entityOf(action: string, entityType: string | null): string {
  if (entityType) return entityType;
  return action.split(".")[0] ?? "unknown";
}

function detailsOf(action: string, meta: unknown): string {
  const metaStr =
    meta && typeof meta === "object" && Object.keys(meta as Record<string, unknown>).length > 0
      ? " " + JSON.stringify(meta).slice(0, 140)
      : "";
  return `${action}${metaStr}`;
}

export default async function AuditPage() {
  const supabase = await createClient();
  let isAdmin = false;
  let entries: AuditEntryLive[] | null = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,full_name")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }

    if (isAdmin) {
      const result = await listAuditLogAction({ limit: 200 });
      if (result.ok) {
        // Resolve actor names in one query
        const actorIds = [
          ...new Set(result.data.entries.map((e) => e.actor_id).filter(Boolean)),
        ] as string[];
        let nameById = new Map<string, string>();
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", actorIds);
          nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]));
        }
        entries = result.data.entries.map((e, i) => {
          const action = String(e.action ?? "unknown");
          const actorId = e.actor_id as string | null;
          const meta = e.meta as Record<string, unknown> | null;
          return {
            id: i + 1,
            at: new Date(String(e.created_at)),
            actor: (actorId && nameById.get(actorId)) || (actorId ? actorId.slice(0, 8) : "system"),
            verb: toVerb(action),
            entity: entityOf(action, (e.entity_type as string | null) ?? null),
            details: detailsOf(action, meta),
            meta: {
              requestId: actorId ? `usr_${actorId.slice(0, 8)}` : "system",
              ip: "—",
              userAgent: "—",
              entityId: String(e.entity_id ?? "—"),
            },
          };
        });
      }
    }
  }

  if (!supabase) {
    // Unconfigured — demo data
    return <AuditView />;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <ScrollText size={36} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
          <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.03em] text-obsidian">Admin only</h1>
          <p className="mt-1.5 max-w-sm text-[14px] leading-snug text-obsidian-light">
            The audit log records every change in the workspace. Only administrators can read it.
          </p>
        </div>
      </div>
    );
  }
  return <AuditView entries={entries ?? []} live />;
}
