import Link from "next/link";
import { Star } from "lucide-react";
import { DashboardPreview } from "@/components/daubo/DashboardPreview";

export function Hero() {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
          A calmer way to move your career forward
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-snug text-emerald-400/95 sm:text-base">
          Daubo prepares you to apply—you still click Apply.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Daubo helps people in{" "}
          <span className="text-zinc-200">any line of work—care, trades, office, clinical roles,</span> and
          beyond—<span className="text-zinc-200">organize roles they care about</span>, get{" "}
          <span className="text-zinc-200">clear, tailored application wording</span> grounded in their real
          résumé, and <span className="text-zinc-200">practice interviews</span> in the same place. You
          always <span className="text-zinc-200">apply on the employer&apos;s or LinkedIn&apos;s own site</span>;
          with Gmail connected we can save <span className="text-zinc-200">draft emails</span> for you to
          review and send—nothing goes out without you.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-full bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_0_40px_-4px_rgba(74,222,128,0.65)] transition hover:bg-emerald-300"
        >
          Get started now
        </Link>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400">
          <span className="text-zinc-500">Daubo job seekers</span>
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-4 w-4 fill-amber-400 text-amber-400"
                strokeWidth={0}
              />
            ))}
          </span>
          <span className="font-semibold text-white">4,9</span>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-zinc-950"
            aria-hidden
          >
            D
          </span>
        </div>
      </div>

      <DashboardPreview />
    </section>
  );
}
