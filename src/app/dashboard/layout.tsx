import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-black px-4 text-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" aria-hidden />
          <p className="text-sm text-zinc-400">Loading your workspace…</p>
          <p className="text-xs text-zinc-600">This usually takes just a moment.</p>
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
