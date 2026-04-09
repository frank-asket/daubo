import Link from "next/link";
import { ArrowRight, Mail, Sparkles, UserRound } from "lucide-react";

/**
 * Workspace summary reflecting the current product: pipeline, Human apply, Gmail drafts, LLM assist.
 */
export function DashboardOverview({ hasResume }: { hasResume: boolean | null }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-[#0f0f0f] via-[#0c0c0c] to-[#080808] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            Daubo workspace
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Find roles, tailor packages, apply on your terms
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Turn on <strong className="font-medium text-zinc-400">prep autopilot</strong> below to
            auto-generate packages (and optional Gmail drafts) for new shortlisted roles. You still{" "}
            <strong className="font-medium text-zinc-400">Human apply</strong> on LinkedIn and career
            sites—Daubo does not auto-submit there. Gmail remains drafts-only until you send.
          </p>
          {!hasResume ? (
            <p className="mt-3 max-w-2xl rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              <UserRound className="-mt-0.5 mr-1 inline h-3.5 w-3.5 opacity-80" />
              Add a resume so packages, Gmail drafts, and interview prep use your real profile.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Applications
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            <Mail className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            Gmail &amp; integrations
          </Link>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
        Tip: use the <strong className="text-zinc-500">Assistant</strong> button (bottom-right) for
        questions about stages, handoff, or prep—the same LLM stack powers chat and your generated
        packages when <code className="text-zinc-500">OPENROUTER_API_KEY</code> is set on the API.
      </p>
    </section>
  );
}
