"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import {
  isOnboardingDone,
} from "@/components/dashboard/onboarding/onboarding-storage";

export function ResumeNudgeBanner() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const pathname = usePathname();
  const { stats, statsReady } = useDashboardStats();
  const hasResume = !statsReady ? null : stats ? Boolean(stats.has_resume) : null;

  if (!isLoaded || !userId) return null;
  if (pathname?.startsWith("/dashboard/resume")) return null;
  if (!isOnboardingDone(userId)) return null;
  if (hasResume === true || hasResume === null) return null;

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 sm:px-5">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 text-center sm:justify-between sm:text-left">
        <p className="flex items-center justify-center gap-2 text-xs text-amber-100/95 sm:justify-start">
          <FileText className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.75} />
          <span>
            <span className="font-semibold">Add your resume</span> so Daubo can tailor applications
            to each role from your real experience.
          </span>
        </p>
        <Link
          href="/dashboard/resume"
          className="shrink-0 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
        >
          My résumé
        </Link>
      </div>
    </div>
  );
}
