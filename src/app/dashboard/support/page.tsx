import Link from "next/link";
import { SupportOverview } from "@/components/dashboard/SupportOverview";

export default function SupportPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-zinc-800 bg-[#080808] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Support</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Help center</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Common questions, billing guidance, and workflow tips for your dashboard.
        </p>
      </section>
      <div className="mt-6">
        <SupportOverview />
      </div>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
