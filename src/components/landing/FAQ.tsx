"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "What is Daubo?",
    a: "Daubo orchestrates multi-agent workflows for job seekers in any industry: agents match your resume to offers worldwide (you are not expected to hunt boards by hand), score fit, and generate a resume variant plus application materials aligned to each posting's requirements. When your inbox is connected, applications can be sent from your own address with tailored materials attached. Interview prep reuses the same job + profile context.",
  },
  {
    q: "Does Daubo create a different resume for every job?",
    a: "Yes. The tailoring agent produces a job-specific resume file (structure and emphasis aligned to that posting) rather than reusing one static PDF for every employer.",
  },
  {
    q: "How does applying through my email work?",
    a: "You connect your inbox securely. Daubo's agents prepare requirement-aligned drafts and attachments and can submit applications through your mailbox so the From address, threading, and replies stay yours, in line with Daubo's terms and your provider's requirements.",
  },
  {
    q: "How fast is the prepare flow?",
    a: "Targets are typically under a minute for packaging, subject to model and provider latency at launch.",
  },
  {
    q: "Is my data secure?",
    a: "We design for encrypted tokens at rest, minimal logging, and tight inbox scopes for sending. Full detail lives in Daubo’s privacy policy.",
  },
  {
    q: "Do I need to verify identity?",
    a: "Your Daubo account handles sign-in and verification; employer-side checks are separate.",
  },
  {
    q: "Which countries and job types are supported?",
    a: "Daubo is built for global use: agents match your profile against openings across markets—not only one country—while you can still steer preferred regions, industries, and languages so documents stay locally credible. Live listings come from feeds and sources you connect or paste; the roadmap adds more integrations by region.",
  },
  {
    q: "Can I use Daubo on mobile?",
    a: "The dashboard is responsive; deep ATS flows may still favor desktop.",
  },
  {
    q: "What are the usage limits?",
    a: "Free tiers cap ingest and model usage; paid tiers raise limits and enable send-from-inbox.",
  },
  {
    q: "How do I contact support?",
    a: "Email on Free; priority windows on Pro and above.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="border-b border-zinc-800 bg-black py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Your questions, answered
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Everything you need to know about workflow, trust, and scope.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Create account now <span aria-hidden>&gt;</span>
          </Link>
        </div>

        <div className="mt-14 grid border-t border-l border-zinc-800 sm:grid-cols-2">
          {faqs.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={item.q} className="border-b border-r border-zinc-800">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 p-5 text-left text-sm font-medium text-white sm:p-6"
                  onClick={() => setOpen(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <Plus
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  />
                </button>
                {isOpen ? (
                  <div className="border-t border-zinc-800 px-5 pb-5 pt-0 text-sm leading-relaxed text-zinc-400 sm:px-6 sm:pb-6">
                    {item.a}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
