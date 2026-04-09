"use client";

import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useState } from "react";

const quotes = [
  {
    text: "Each posting gets its own resume PDF and email draft—I tweak, approve, and it actually sends from my inbox. Replies don’t land in some random relay.",
    name: "Alex M.",
    role: "Registered nurse · Toronto",
    initials: "A",
  },
  {
    text: "Interview prep pulled from the same packet I applied with—no more contradictory stories between the cover letter and prep.",
    name: "Jordan K.",
    role: "Operations supervisor · Rotterdam",
    initials: "J",
  },
  {
    text: "We use Daubo with our cohorts—health, logistics, office, tech. The pipeline view makes what’s next obvious.",
    name: "Samira L.",
    role: "Career coach",
    initials: "S",
  },
];

export function Testimonials() {
  const [i, setI] = useState(0);
  const q = quotes[i];

  return (
    <section id="testimonials" className="border-b border-zinc-800 bg-black py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Trusted by serious job seekers
          </h2>
          <p className="max-w-md text-lg text-zinc-400 lg:text-right">
            Built for people who want leverage, transparency, and control at the
            moments that touch employers.
          </p>
        </div>

        <div className="mt-14 flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0a0a] lg:flex-row">
          <div className="flex flex-1 flex-col gap-6 border-b border-zinc-800 p-8 lg:border-b-0 lg:border-r lg:border-zinc-800 lg:p-10">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-cyan-600/80 text-lg font-bold text-white ring-2 ring-zinc-700"
                aria-hidden
              >
                {q.initials}
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white">
                <Zap className="h-5 w-5 fill-white" strokeWidth={0} />
              </span>
            </div>
            <blockquote className="text-xl font-medium leading-snug text-white sm:text-2xl">
              &ldquo;{q.text}&rdquo;
            </blockquote>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-4">
              <div>
                <p className="font-semibold text-white">{q.name}</p>
                <p className="text-sm text-zinc-500">{q.role}</p>
              </div>
              <p className="text-sm text-zinc-500">
                {i + 1}/{quotes.length}
              </p>
            </div>
          </div>
          <div className="flex flex-row justify-stretch divide-x divide-zinc-800 lg:w-52 lg:flex-col lg:divide-x-0 lg:divide-y">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 py-6 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white lg:flex-none"
              onClick={() => setI((v) => (v - 1 + quotes.length) % quotes.length)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 py-6 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white lg:flex-none"
              onClick={() => setI((v) => (v + 1) % quotes.length)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
