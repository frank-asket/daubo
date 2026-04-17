import { AgentStatusBoard } from "@/components/dashboard/AgentStatusBoard";

export default function AgentStatusPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-zinc-800 bg-[#080808] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Agents</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Agent status
        </h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          Monitor orchestration health, availability, and backend execution state.
        </p>
      </section>
      <div>
        <AgentStatusBoard />
      </div>
    </div>
  );
}
