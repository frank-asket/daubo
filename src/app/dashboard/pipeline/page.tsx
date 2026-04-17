import { Suspense } from "react";
import { ApplicationsWorkspace } from "@/components/dashboard/ApplicationsWorkspace";

export default function PipelinePage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-zinc-800 bg-[#080808] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Pipeline</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Application pipeline
        </h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          Manage your outreach, interviews, and follow-ups in one flow.
        </p>
      </section>
      <div>
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-8 text-sm text-zinc-500">
              Loading pipeline…
            </div>
          }
        >
          <ApplicationsWorkspace />
        </Suspense>
      </div>
    </div>
  );
}
