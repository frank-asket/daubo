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
        <div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-500">
          Loading workspace…
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
