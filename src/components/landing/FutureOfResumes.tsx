import Link from "next/link";

/** Narrative block: résumé loop + Daubo’s guardrailed assistant (not a public “digital twin” product). */
export function FutureOfResumes() {
  return (
    <section
      id="future-resumes"
      className="border-b border-zinc-800 bg-gradient-to-b from-[#070707] to-black py-20 sm:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
          The future of résumés
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Stop rewriting the same story for every posting
        </h2>
        <div className="mt-6 space-y-4 text-left text-base leading-relaxed text-zinc-400 sm:text-lg">
          <p>
            The old loop: hours tweaking bullets and summaries so you sound right for{" "}
            <em className="text-zinc-300 not-italic">this</em> recruiter and{" "}
            <em className="text-zinc-300 not-italic">that</em> ATS—then doing it again tomorrow.
          </p>
          <p>
            <span className="text-zinc-200">Daubo starts from your real résumé and credentials</span>{" "}
            (nothing invented), then helps you shape{" "}
            <span className="text-zinc-200">application-specific wording, checklists, and interview prep</span>{" "}
            per role. It&apos;s a <span className="text-zinc-200">guardrailed assistant inside your workspace</span>
            —not a public chatbot pretending to be you, and not auto-submitting on employer sites.
          </p>
          <p className="text-sm text-zinc-500 sm:text-base">
            You review and edit; you click Apply and Send. That&apos;s the balance between leverage and trust.
          </p>
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex rounded-full bg-emerald-400 px-8 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_0_32px_-6px_rgba(74,222,128,0.55)] transition hover:bg-emerald-300"
          >
            Open your workspace
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-400 underline-offset-4 hover:text-emerald-400 hover:underline"
          >
            Already signed in →
          </Link>
        </div>
      </div>
    </section>
  );
}
