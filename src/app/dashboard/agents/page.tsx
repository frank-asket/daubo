import { AgentStatusBoard } from "@/components/dashboard/AgentStatusBoard";

export default function AgentStatusPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-[2rem] font-semibold tracking-tight text-white">Agent status</h1>
      <p className="mt-1 text-lg text-zinc-500">Multi-agent orchestration layer</p>
      <div className="mt-8">
        <AgentStatusBoard />
      </div>
    </div>
  );
}
