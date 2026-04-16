import { Suspense } from "react";
import { ApplicationsWorkspace } from "@/components/dashboard/ApplicationsWorkspace";

export default function PipelinePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Application pipeline</h1>
      <p className="mt-1 text-sm text-zinc-400">Track and manage all your applications</p>
      <div className="mt-8">
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
