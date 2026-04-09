"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "What is Daubo?",
    a: "Daubo is a career workspace for job seekers in any field. You save roles you care about, get help tailoring application wording from your real résumé, apply on employer or LinkedIn sites yourself, and practice interviews with questions tied to those roles. With Gmail connected, Daubo can save outreach as drafts—you review and send.",
  },
  {
    q: "Does Daubo create a different resume for every job?",
    a: "Daubo helps you produce job-specific materials (for example tailored bullets and letters) aligned to what each posting emphasizes. You can adjust everything before you use it.",
  },
  {
    q: "How does Gmail work?",
    a: "If you connect Google, Daubo can create email drafts in your Gmail account so you can edit and send from your own address. Daubo does not send mail automatically.",
  },
  {
    q: "Does Daubo apply for me?",
    a: "No. You submit applications on the company career site or LinkedIn yourself. That keeps your accounts safe and respects how employers expect to receive applications.",
  },
  {
    q: "How fast is it?",
    a: "Generating suggestions usually takes about a minute, depending on load and your connection.",
  },
  {
    q: "Is my data secure?",
    a: "We design for encrypted storage where it matters, limited logging, and narrow permissions when you connect email. Details belong in Daubo’s privacy policy.",
  },
  {
    q: "Do I need to verify identity?",
    a: "Your Daubo sign-in handles your account. Employers may run their own background or credential checks separately.",
  },
  {
    q: "Which countries and job types are supported?",
    a: "You can use Daubo wherever you are searching. Quality depends on the roles and text you bring—paste job ads, add links, and refine your country or field in Discover for better suggestions.",
  },
  {
    q: "Can I use Daubo on mobile?",
    a: "The dashboard works on phones and tablets; long application forms on employer sites are often easier on a computer.",
  },
  {
    q: "What are the usage limits?",
    a: "Free and paid plans differ in how many jobs and AI assists you can use each month. Check the pricing page for current tiers.",
  },
  {
    q: "How do I contact support?",
    a: "Email on Free; priority support on paid plans where offered.",
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
              Straightforward answers—no jargon required.
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
