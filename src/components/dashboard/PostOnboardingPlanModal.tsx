"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, Sparkles, Zap } from "lucide-react";
import {
  clearPlanPromptPending,
  getSelectedPlanTier,
  isOnboardingDone,
  isPlanPromptPending,
  type SelectedPlanTier,
  setSelectedPlanTier,
} from "@/components/dashboard/onboarding/onboarding-storage";

const TIERS: {
  id: SelectedPlanTier;
  name: string;
  blurb: string;
  badge?: string;
  icon: typeof Sparkles;
  highlights: string[];
}[] = [
  {
    id: "free_trial",
    name: "Free",
    badge: "30-day trial",
    blurb: "Full workspace access to see if Daubo fits your search—saved jobs, drafts, and prep.",
    icon: Sparkles,
    highlights: ["All core features for 30 days", "Upgrade anytime before trial ends"],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For active job seekers who want higher limits and priority tooling.",
    icon: Zap,
    highlights: ["Higher saved-job & AI caps", "Best for one focused search"],
  },
  {
    id: "business",
    name: "Business",
    blurb: "Teams and high-volume searches—shared patterns, scale, and support.",
    icon: Building2,
    highlights: ["Team-ready (coming soon)", "Talk to us for rollout"],
  },
];

export function PostOnboardingPlanModal() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (!isOnboardingDone(userId)) return;
    if (!isPlanPromptPending(userId)) return;
    if (getSelectedPlanTier(userId)) {
      clearPlanPromptPending(userId);
      return;
    }
    setOpen(true);
  }, [isLoaded, userId]);

  function closeAndClearPending() {
    if (userId) clearPlanPromptPending(userId);
    setOpen(false);
  }

  function chooseTier(tier: SelectedPlanTier) {
    if (!userId) return;
    setSelectedPlanTier(userId, tier);
    clearPlanPromptPending(userId);
    setOpen(false);
  }

  if (!open || !userId) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
    >
      <div className="relative max-h-[min(92vh,880px)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#0a0a0a] shadow-2xl shadow-emerald-950/20">
        <div className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#0a0a0a]/95 px-5 py-4 backdrop-blur-sm sm:px-8 sm:py-5">
          <div className="flex items-center gap-2 text-emerald-400">
            <Sparkles className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
              Choose your plan
            </span>
          </div>
          <h2 id="plan-modal-title" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Welcome aboard — pick how you want to start
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            You can change this later in Settings. Pro and Business checkout will connect when billing goes live;
            for now we save your choice and you can explore on the free trial.
          </p>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:gap-3 sm:px-8 sm:py-6">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => chooseTier(tier.id)}
                className="group flex flex-col rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-left transition hover:border-emerald-500/50 hover:bg-zinc-900/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 sm:p-5"
              >
                {tier.badge ? (
                  <span className="mb-2 inline-flex w-fit rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    {tier.badge}
                  </span>
                ) : null}
                <div className="flex items-start gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">{tier.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                      {tier.blurb}
                    </p>
                  </div>
                </div>
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-zinc-800 pt-4">
                  {tier.highlights.map((line) => (
                    <li key={line} className="flex gap-2 text-xs text-zinc-400">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/90" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <span className="mt-4 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                  Select {tier.name} →
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:justify-between sm:px-8">
          <Link
            href="/pricing"
            onClick={closeAndClearPending}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
          >
            Compare plans on the full pricing page
          </Link>
          <button
            type="button"
            onClick={closeAndClearPending}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-400"
          >
            Decide later
          </button>
        </div>
      </div>
    </div>
  );
}
