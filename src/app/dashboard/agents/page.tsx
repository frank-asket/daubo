import { AgentStatusBoard } from "@/components/dashboard/AgentStatusBoard";

export default function AgentStatusPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Agent status</h1>
      <p className="mt-1 text-sm text-zinc-400">Multi-agent orchestration layer</p>
      <div className="mt-8">
        <AgentStatusBoard />
      </div>
    </div>
  );
}
