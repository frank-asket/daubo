import Link from "next/link";
import { InterviewPrepBoard } from "@/components/dashboard/InterviewPrepBoard";

export default function InterviewsPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Interview prep</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Prep checklists tied to roles in your Daubo pipeline. Deeper mocks and stories from your
        resume layer in next.
      </p>
      <div className="mt-10">
        <InterviewPrepBoard />
      </div>
      <Link
        href="/dashboard"
        className="mt-10 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
