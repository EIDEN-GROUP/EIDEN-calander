"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";

/** Inline "mark read" control: one per notification, or "mark all" without props. */
export function MarkReadIsland({ id }: { id?: string }) {
  const router = useRouter();
  const t = useTranslations("notifications");
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      if (id) {
        await markNotificationReadAction({ id });
      } else {
        await markAllNotificationsReadAction();
      }
      router.refresh();
    });
  };

  if (id) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={t("markAsRead")}
        title={t("markAsRead")}
        className="rounded-pill p-2 text-muted transition-colors hover:bg-electric-tint hover:text-electric disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} strokeWidth={2.4} aria-hidden="true" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="btn btn-secondary h-10 gap-2 text-[13px] disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={15} strokeWidth={2} aria-hidden="true" />}
      {t("markAllRead")}
    </button>
  );
}
