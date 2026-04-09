import Link from "next/link";
import { ResumeWorkspace } from "@/components/dashboard/ResumeWorkspace";

export default function ResumePage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">My résumé</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        This is the profile Daubo uses for every suggestion. Upload a file or paste your experience—then
        check the text matches what you want employers to see.
      </p>
      <div className="mt-8">
        <ResumeWorkspace />
      </div>
      <Link
        href="/dashboard"
        className="mt-10 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
