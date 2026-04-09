"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import {
  isOnboardingDone,
  setOnboardingDone,
} from "@/components/dashboard/onboarding/onboarding-storage";

const STEPS = [
  {
    title: "Welcome to Daubo",
    body: "You’re in the workspace where discovery, tailored resumes, and applications come together—always with you in control.",
  },
  {
    title: "Start with your resume",
    body: "Add your base resume once (paste text on the Resume page). Daubo uses it as the source of truth—we don’t invent employers, dates, or credentials.",
  },
  {
    title: "Match & personalize",
    body: "Point Daubo at the countries and roles you care about. Agents score fit and draft a job-specific resume variant plus application copy for each listing.",
  },
  {
    title: "Approve, then send as you",
    body: "Every outbound message is held for your sign-off. When your inbox is connected, sends go from your address so threads and replies stay yours.",
  },
  {
    title: "You’re set",
    body: "Add your resume to unlock fully personalized packages. You can explore the dashboard anytime—this intro won’t show again once you continue.",
  },
] as const;

export function OnboardingWalkthrough() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const { stats, statsReady } = useDashboardStats();
  const hasResume = !statsReady ? null : stats ? Boolean(stats.has_resume) : null;
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (userId && hasResume === true) {
      setOnboardingDone(userId);
      setOpen(false);
    }
  }, [userId, hasResume]);

  useEffect(() => {
    if (!isLoaded || !userId || !statsReady) return;
    if (hasResume === true) {
      setOpen(false);
      return;
    }
    if (hasResume === false && !isOnboardingDone(userId)) {
      setOpen(true);
      setStep(0);
    }
  }, [isLoaded, userId, statsReady, hasResume]);

  function finishTour() {
    if (userId) setOnboardingDone(userId);
    setOpen(false);
  }

  function skipTour() {
    finishTour();
  }

  if (!open || !userId) return null;

  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-700 bg-[#0a0a0a] p-6 shadow-2xl shadow-emerald-950/20">
        <div className="mb-4 flex items-center gap-2 text-emerald-400">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
            Quick tour
          </span>
        </div>

        <h2 id="onboarding-title" className="text-xl font-semibold tracking-tight text-white">
          {current.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{current.body}</p>

        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-emerald-400" : "w-1.5 bg-zinc-600"
              }`}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={skipTour}
            className="order-3 text-center text-xs font-medium text-zinc-500 hover:text-zinc-300 sm:order-1 sm:text-left"
          >
            Skip intro
          </button>
          <div className="order-1 flex gap-2 sm:order-2 sm:ml-auto">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-400 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
            {!last ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/dashboard/resume"
                  onClick={finishTour}
                  className="inline-flex justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                >
                  Add my resume
                </Link>
                <button
                  type="button"
                  onClick={finishTour}
                  className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-400"
                >
                  Explore workspace
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
