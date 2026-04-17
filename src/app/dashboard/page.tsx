import { BackendStatus } from "@/components/dashboard/BackendStatus";
import { DiscoverWorkspace } from "@/components/dashboard/DiscoverWorkspace";

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 via-zinc-950 to-black p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Find and track your next role
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Live discovery + pipeline updates are connected to your backend streams so your workspace stays current.
        </p>
      </section>
      <BackendStatus />
      <section className="rounded-3xl border border-zinc-800 bg-[#080808] p-3 sm:p-4">
        <DiscoverWorkspace />
      </section>
    </div>
  );
}
