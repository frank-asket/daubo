import Link from "next/link";
import { InterviewPrepBoard } from "@/components/dashboard/InterviewPrepBoard";

export default function InterviewsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-[2rem] font-semibold tracking-tight text-white">Interview preparation</h1>
      <p className="mt-1 max-w-2xl text-lg text-zinc-500">
        AI-generated questions and STAR-R story bank
      </p>
      <div className="mt-8">
        <InterviewPrepBoard />
      </div>
      <Link href="/dashboard/pipeline" className="mt-8 inline-flex text-sm font-semibold text-emerald-400 hover:underline">
        Back to pipeline
      </Link>
    </div>
  );
}
