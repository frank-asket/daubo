import Link from "next/link";
import { ArrowRight, Mail, Sparkles, UserRound } from "lucide-react";

/** Hero for job seekers: outcomes-first, not infrastructure. */
export function DashboardOverview({ hasResume }: { hasResume: boolean | null }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-[#0f0f0f] via-[#0c0c0c] to-[#080808] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            Your career workspace
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Move forward on your job search—with help that keeps you in charge
          </h1>
          <p className="mt-2 text-sm font-medium text-emerald-400/90">
            Daubo prepares you to apply—you still click Apply.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Daubo helps you <strong className="font-medium text-zinc-400">find roles</strong>,{" "}
            <strong className="font-medium text-zinc-400">shape stronger applications</strong>, and{" "}
            <strong className="font-medium text-zinc-400">prepare for interviews</strong>. Turn on{" "}
            <strong className="font-medium text-zinc-400">Smart prep</strong> below and we’ll draft
            materials for new jobs you save—you always review and hit &ldquo;send&rdquo; yourself on
            company sites and LinkedIn.
          </p>
          {!hasResume ? (
            <p className="mt-3 max-w-2xl rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              <UserRound className="-mt-0.5 mr-1 inline h-3.5 w-3.5 opacity-80" />
              Start by adding your resume so every suggestion reflects your real story.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            My jobs
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            <Mail className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            Email &amp; account
          </Link>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
        Questions or stuck on a step? Tap <strong className="text-zinc-500">Coach</strong>{" "}
        (bottom-right)—quick help for how Daubo works and what to do next.
      </p>
    </section>
  );
}
