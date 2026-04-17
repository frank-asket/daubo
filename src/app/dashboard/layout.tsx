import Link from "next/link";
import { Suspense } from "react";
import {
  Compass,
  ListFilter,
  CheckSquare,
  BookOpen,
  FileText,
  Cpu,
  ChevronRight,
} from "lucide-react";
import { DashboardStatsProvider } from "@/components/dashboard/DashboardStatsContext";

const NAV = [
  { href: "/dashboard", label: "Discover", icon: Compass },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: ListFilter },
  { href: "/dashboard/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/dashboard/interviews", label: "Interview prep", icon: BookOpen },
  { href: "/dashboard/resume", label: "My resume", icon: FileText },
  { href: "/dashboard/agents", label: "Agents", icon: Cpu },
];

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardStatsProvider>
    <div className="flex min-h-screen bg-black text-zinc-100">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-800 bg-zinc-950/80 lg:flex lg:flex-col">
        <div className="border-b border-zinc-800 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-400">
              <ChevronRight size={14} className="text-zinc-950" strokeWidth={3} />
            </div>
            <span className="text-base font-semibold text-white">Daubo</span>
          </div>
          <p className="ml-9 mt-1 text-[10px] text-zinc-500">Job search AI</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                <Icon size={15} className="text-zinc-500 group-hover:text-emerald-300" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" aria-hidden />
              <p className="text-sm text-zinc-400">Loading your workspace…</p>
              <p className="text-xs text-zinc-600">This usually takes just a moment.</p>
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
    </DashboardStatsProvider>
  );
}
