import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/80">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
      >
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-[100px]" />
        <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-20 lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="flex-1 space-y-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)]" />
            Multi-agent job search &amp; resume
          </p>

          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-5xl lg:text-[3.25rem]">
            Take control of your{" "}
            <span className="text-[var(--mint)]">career pipeline</span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
            Daubo offers a structured, explainable workflow from job discovery to
            tailored applications and interview prep—powered by specialized agents
            and your explicit approval before anything is sent.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-7 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
            >
              Get started now
            </Link>
            <Link
              href="#why"
              className="text-sm font-medium text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            >
              See why teams switch
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-8 border-t border-zinc-800/80 pt-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                They trust the workflow
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-3xl font-semibold text-zinc-50">
                  4.9
                </span>
                <span className="text-sm text-zinc-500">/5 from early access</span>
              </div>
            </div>
            <div className="flex gap-6 opacity-60 grayscale">
              {["Nexora", "Vectorline", "Bluegrain", "Orbital"].map((name) => (
                <span
                  key={name}
                  className="font-[family-name:var(--font-display)] text-sm font-semibold text-zinc-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="relative rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]">
            <div className="rounded-xl bg-[#0a0a0b] p-6 sm:p-8">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Orchestrator</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-[var(--mint)]">
                  live
                </span>
              </div>
              <ul className="mt-6 space-y-4">
                {[
                  { step: "Match", detail: "JD × resume — scored with reasons" },
                  { step: "Tailor", detail: "Package + resume variant for this role" },
                  { step: "Approve", detail: "You confirm before Gmail send" },
                  { step: "Prep", detail: "Interview brief from same context" },
                ].map((row) => (
                  <li
                    key={row.step}
                    className="flex gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3"
                  >
                    <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--mint)]">
                      {row.step}
                    </span>
                    <span className="text-sm text-zinc-400">{row.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs leading-relaxed text-zinc-600">
                Inspired by the structure of the{" "}
                <a
                  href="https://www.framer.com/marketplace/templates/cryptix/"
                  className="text-zinc-500 hover:text-zinc-400"
                  target="_blank"
                  rel="noreferrer"
                >
                  Cryptix
                </a>{" "}
                Framer template — same dark, conversion-focused rhythm; built for
                careers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
