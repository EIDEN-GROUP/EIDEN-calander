import { Suspense, type ReactNode } from "react";
import { NavRail } from "@/components/shell/NavRail";
import { TopBar } from "@/components/shell/TopBar";
import { BottomNav } from "@/components/shell/BottomNav";
import { DemoBanner } from "@/components/shell/DemoBanner";

export default function AppLayout({ children }: { children: ReactNode }) {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Suspense: usePathname() streams in at request time (Next 16) */}
      <Suspense fallback={<div className="fixed inset-y-0 left-0 z-40 hidden w-[76px] lg:block" aria-hidden="true" />}>
        <NavRail />
      </Suspense>
      <div className="lg:pl-[76px]">
        {!supabaseConfigured && <DemoBanner />}
        <Suspense fallback={<div className="frosted sticky top-0 z-30 h-[68px]" aria-hidden="true" />}>
          <TopBar />
        </Suspense>
        <main className="px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-7 lg:pb-10 lg:pt-7">
          {children}
        </main>
      </div>
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-border bg-surface-elevated lg:hidden" aria-hidden="true" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
