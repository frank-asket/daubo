"use client";

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { DauboSidebar } from "@/components/daubo/DauboSidebar";
import { OnboardingWalkthrough } from "@/components/dashboard/OnboardingWalkthrough";
import { ResumeNudgeBanner } from "@/components/dashboard/ResumeNudgeBanner";

const pathToActive: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/applications": "Applications",
  "/dashboard/resume": "Resume",
  "/dashboard/interviews": "Interview prep",
  "/dashboard/settings": "Settings",
  "/dashboard/profile": "Profile",
  "/dashboard/support": "Support",
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/dashboard";
  const active = pathToActive[path] ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-black text-zinc-50">
      <OnboardingWalkthrough />
      <DauboSidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#050505]">
        <ResumeNudgeBanner />
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 px-5 py-4">
          <div>
            <p className="text-[11px] text-zinc-500">Workspace / Dashboard</p>
            <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Main Dashboard
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <div className="hidden items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 sm:flex">
              <Search className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
              <span className="text-xs text-zinc-500">Search by country · role</span>
            </div>
            <UserButton />
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
