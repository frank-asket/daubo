import { Suspense } from "react";
import { ApplicationsWorkspace } from "@/components/dashboard/ApplicationsWorkspace";

export default function PipelinePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-[2rem] font-semibold tracking-tight text-zinc-950">Application pipeline</h1>
      <p className="mt-1 text-lg text-zinc-700">Track and manage all your applications</p>
      <div className="mt-8">
        <Suspense
          fallback={
            <div className="rounded-[24px] border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
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
