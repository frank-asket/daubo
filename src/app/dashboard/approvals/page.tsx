import { ApprovalsBoard } from "@/components/dashboard/ApprovalsBoard";

export default function ApprovalsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-zinc-800 bg-[#080808] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Approvals</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pending approvals
        </h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          Review AI-drafted applications before anything is sent.
        </p>
      </section>
      <div className="mt-6">
        <ApprovalsBoard />
      </div>
    </div>
  );
}
