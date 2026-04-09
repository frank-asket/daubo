import Link from "next/link";
import { ResumeWorkspace } from "@/components/dashboard/ResumeWorkspace";

export default function ResumePage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Resume</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Your master profile: upload PDF, Word, images, or paste text. Ingest triggers the agent
        layer so matching and tailoring use this source of truth.
      </p>
      <div className="mt-8">
        <ResumeWorkspace />
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
