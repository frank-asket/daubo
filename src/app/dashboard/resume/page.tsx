import Link from "next/link";
import { ResumeWorkspace } from "@/components/dashboard/ResumeWorkspace";

export default function ResumePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-[2rem] font-semibold tracking-tight text-white">My resume</h1>
      <p className="mt-1 max-w-2xl text-lg text-zinc-500">
        Upload your resume to power matching and tailoring
      </p>
      <div className="mt-8">
        <ResumeWorkspace />
      </div>
      <Link href="/dashboard" className="mt-8 inline-flex text-sm font-semibold text-emerald-400 hover:underline">
        Back to discover
      </Link>
    </div>
  );
}
