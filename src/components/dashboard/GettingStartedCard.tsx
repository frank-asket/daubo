"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, Circle, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type OnboardingStats,
  useDashboardStats,
} from "@/components/dashboard/DashboardStatsContext";
import {
  isGettingStartedDismissed,
  setGettingStartedDismissed,
} from "@/components/dashboard/onboarding/getting-started-dismiss";
import { supportEmail } from "@/lib/customer-config";

/**
 * First-run checklist for real customers — driven by `/v1/me/stats` onboarding slice.
 */
export function GettingStartedCard() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const { stats, statsReady } = useDashboardStats();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setDismissed(isGettingStartedDismissed(userId));
  }, [userId]);

  if (!isLoaded || !userId || !statsReady || dismissed) return null;

  const o = stats?.onboarding as OnboardingStats | undefined;
  if (!o) return null;

  const uid = userId;

  const email = supportEmail();

  const steps: { done: boolean; title: string; hint: string; href: string; cta: string }[] = [
    {
      done: o.resume_added,
      title: "Add your résumé",
      hint: "Daubo uses it for every tailored suggestion—nothing is invented.",
      href: "/dashboard/resume",
      cta: "My résumé",
    },
    {
      done: o.job_saved,
      title: "Save at least one job",
      hint: "From Discover below or manually under My jobs.",
      href: "/dashboard/applications",
      cta: "My jobs",
    },
    {
      done: o.gmail_connected,
      title: "Connect Gmail (optional)",
      hint: "Save application emails as drafts—you still press send.",
      href: "/dashboard/settings",
      cta: "Email settings",
    },
  ];

  const coreDone = o.setup_complete;

  return (
    <section className="relative rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-transparent px-5 py-4">
      <button
        type="button"
        onClick={() => {
          setGettingStartedDismissed(uid);
          setDismissed(true);
        }}
        className="absolute right-3 top-3 rounded-lg border border-zinc-700 p-1.5 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300"
        aria-label="Hide getting started checklist"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-10">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
          Getting started
        </p>
        <h2 className="mt-1 text-sm font-semibold text-white">
          {coreDone ? "You’re ready to use Daubo" : "Finish these steps when you have a minute"}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {coreDone
            ? "You can hide this card anytime. Use Discover and Smart prep when you want help drafting."
            : "Most people complete this in a few minutes. You can come back later—your progress saves automatically."}
        </p>
      </div>
      <ul className="mt-4 space-y-2.5">
        {steps.map((s) => (
          <li
            key={s.title}
            className="flex gap-3 rounded-xl border border-zinc-800/80 bg-black/25 px-3 py-2.5"
          >
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" strokeWidth={1.75} />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" strokeWidth={1.75} />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${s.done ? "text-zinc-400 line-through" : "text-zinc-100"}`}>
                {s.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{s.hint}</p>
              {!s.done ? (
                <Link
                  href={s.href}
                  className="mt-1.5 inline-flex text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  {s.cta} →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {o.setup_complete && !o.gmail_connected ? (
        <p className="mt-3 text-[11px] text-zinc-600">
          Gmail is optional—skip it if you prefer to copy drafts from Daubo manually.
        </p>
      ) : null}
      {email ? (
        <p className="mt-3 text-[11px] text-zinc-600">
          Questions?{" "}
          <a href={`mailto:${encodeURIComponent(email)}`} className="font-medium text-emerald-400 hover:underline">
            {email}
          </a>
        </p>
      ) : null}
    </section>
  );
}
