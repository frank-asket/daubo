"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";

export type CareerSnapshot = {
  ready_to_submit: number;
  package_ready: number;
  exploring: number;
  applied_or_interview: number;
};

function emptyCareer(): CareerSnapshot {
  return {
    ready_to_submit: 0,
    package_ready: 0,
    exploring: 0,
    applied_or_interview: 0,
  };
}

/**
 * Plain-language priorities so Daubo feels like a career service, not a dev console.
 */
export function CareerNextStepsCard() {
  const { stats, statsReady } = useDashboardStats();
  const hasResume = stats?.has_resume ?? false;
  const career = stats?.career ?? emptyCareer();

  type Step = { done: boolean; title: string; hint: string; href: string; cta: string };

  const steps: Step[] = [];

  if (!statsReady) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
        <p className="text-sm text-zinc-500">Loading your next steps…</p>
      </div>
    );
  }

  if (!hasResume) {
    steps.push({
      done: false,
      title: "Add your experience",
      hint: "Upload or paste your resume once—everything else builds from what you’ve really done.",
      href: "/dashboard/resume",
      cta: "Add resume",
    });
  }

  if (hasResume && career.exploring === 0 && career.package_ready === 0 && career.ready_to_submit === 0) {
    steps.push({
      done: false,
      title: "Save roles you’re interested in",
      hint: "Run a search below or add jobs manually—you’ll get tailored applications for each one.",
      href: "/dashboard/applications",
      cta: "Track a job",
    });
  }

  if (career.package_ready > 0) {
    steps.push({
      done: false,
      title: `Review ${career.package_ready} prepared application${career.package_ready === 1 ? "" : "s"}`,
      hint: "Open each job and send when it feels right—we never submit for you on company sites.",
      href: "/dashboard/applications",
      cta: "Review & apply",
    });
  }

  if (career.ready_to_submit > 0) {
    steps.push({
      done: false,
      title: `${career.ready_to_submit} role${career.ready_to_submit === 1 ? "" : "s"} ready to send`,
      hint: "Finish submissions on the employer’s site or send from a Gmail draft if you connected email.",
      href: "/dashboard/applications",
      cta: "Go to my jobs",
    });
  }

  if (career.applied_or_interview > 0) {
    steps.push({
      done: false,
      title: "Practice for upcoming conversations",
      hint: "Generate interview questions tailored to the jobs you’ve applied for.",
      href: "/dashboard/interviews",
      cta: "Interview practice",
    });
  }

  if (steps.length === 0 && hasResume) {
    steps.push({
      done: true,
      title: "You’re on track",
      hint: "Keep adding roles and use Smart prep when you want Daubo to draft application materials for you.",
      href: "/dashboard",
      cta: "Home",
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Your next steps</h2>
        {hasResume && stats && stats.application_count > 0 ? (
          <span className="text-[11px] text-zinc-500">{stats.application_count} jobs tracked</span>
        ) : null}
      </div>
      <ul className="mt-4 space-y-3">
        {steps.map((s) => (
          <li
            key={s.title}
            className="flex gap-3 rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-3"
          >
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" strokeWidth={1.75} />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" strokeWidth={1.75} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.hint}</p>
              <Link
                href={s.href}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                {s.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
