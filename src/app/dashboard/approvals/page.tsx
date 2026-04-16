import { ApprovalsBoard } from "@/components/dashboard/ApprovalsBoard";

export default function ApprovalsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Pending approvals</h1>
      <p className="mt-1 text-sm text-zinc-400">Review AI-drafted applications before they are sent</p>
      <div className="mt-8">
        <ApprovalsBoard />
      </div>
    </div>
  );
}
