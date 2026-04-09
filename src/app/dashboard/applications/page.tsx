import Link from "next/link";
import { ApplicationsBoard } from "@/components/dashboard/ApplicationsBoard";

export default function ApplicationsPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Applications</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Your Daubo pipeline: track every role, stage, and link in one place. Data is stored per
        account on the Daubo API.
      </p>
      <div className="mt-10">
        <ApplicationsBoard />
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
