import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { NavRail } from "@/components/shell/NavRail";
import { TopBar } from "@/components/shell/TopBar";
import { BottomNav } from "@/components/shell/BottomNav";
import { DemoBanner } from "@/components/shell/DemoBanner";
import { KeyboardManager } from "@/components/keyboard/KeyboardManager";
import { RouteTransition } from "@/components/shell/RouteTransition";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tShell = await getTranslations("shell");
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-pill focus:bg-obsidian focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white"
      >
        {tShell("skipToContent")}
      </a>
      {/* Suspense: usePathname() streams in at request time (Next 16) */}
      <Suspense fallback={<div className="fixed inset-y-0 left-0 z-40 hidden w-[76px] lg:block" aria-hidden="true" />}>
        <NavRail />
      </Suspense>
      <div className="lg:pl-[76px]">
        {!supabaseConfigured && <DemoBanner />}
        <Suspense fallback={<div className="frosted sticky top-0 z-30 h-[68px]" aria-hidden="true" />}>
          <TopBar />
        </Suspense>
        <main id="main" tabIndex={-1} className="px-4 pb-24 pt-5 sm:px-6 sm:pt-6 focus:shadow-none focus-visible:shadow-none lg:px-7 lg:pb-10 lg:pt-7">
          <Suspense fallback={<div className="view-enter">{children}</div>}>
            <RouteTransition>{children}</RouteTransition>
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <KeyboardManager />
        </Suspense>
      </div>
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-border bg-surface-elevated lg:hidden" aria-hidden="true" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
