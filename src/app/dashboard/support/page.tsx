import Link from "next/link";
import { SupportOverview } from "@/components/dashboard/SupportOverview";

export default function SupportPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Support</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Common questions, billing, and tips—plus the Coach in the corner of any dashboard page for
        how-to help.
      </p>
      <div className="mt-8">
        <SupportOverview />
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
