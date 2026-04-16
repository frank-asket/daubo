import Link from "next/link";
import { Star } from "lucide-react";
import { DashboardPreview } from "@/components/daubo/DashboardPreview";

export function Hero() {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
          The platform for your next chapter—dream job or your own venture
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-snug text-emerald-400/95 sm:text-base">
          Production-grade automation for your profile, pipeline, and materials—you still click Apply and Send.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Daubo is built for people actively looking for opportunity:{" "}
          <span className="text-zinc-200">
            land a role you want, or professionalize the story behind a business or side project you’re
            building.
          </span>{" "}
          In one workspace you <span className="text-zinc-200">keep résumé, credentials, and jobs organized</span>,
          get <span className="text-zinc-200">tailored application wording</span> grounded in your real profile,
          and <span className="text-zinc-200">practice interviews</span>. We automate the heavy lifting—not
          decisions on your behalf. You always{" "}
          <span className="text-zinc-200">submit on the employer&apos;s or LinkedIn&apos;s own site</span>; with
          Gmail connected we save <span className="text-zinc-200">draft emails</span> you review before anything
          goes out.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex rounded-full bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_0_40px_-4px_rgba(74,222,128,0.65)] transition hover:bg-emerald-300"
          >
            Get started now
          </Link>
          <Link
            href="/pricing"
            className="inline-flex rounded-full border border-zinc-600 px-7 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-400 hover:text-white"
          >
            See pricing
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400">
          <span className="text-zinc-500">Daubo members</span>
          <span className="flex gap-0.5" role="img" aria-label="5 out of 5 stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-4 w-4 fill-amber-400 text-amber-400"
                strokeWidth={0}
              />
            ))}
          </span>
          <span className="font-semibold text-white">4.9</span>
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
