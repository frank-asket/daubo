"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

const tiers = [
  {
    name: "Free",
    monthly: "€0",
    yearly: "€0",
    blurb: "Explore agent matching, resume tailoring previews, and drafts—without live send from your inbox.",
    featured: false,
    features: [
      "Limited matched opportunities / month",
      "Match scores + explanations",
      "Multi-agent draft: email + resume bullets per job",
      "Pipeline dashboard",
      "Resume PDF upload (source profile)",
      "Email support",
      "Apply-from-your-inbox not included",
    ],
    includedLabel: "Included",
  },
  {
    name: "Pro",
    monthly: "€12",
    yearly: "€10",
    blurb: "Personalized resume files per posting + real applications from your own inbox.",
    featured: true,
    features: [
      "Higher job + model quotas",
      "Daubo send: use your address with attachments (connected inbox)",
      "PDF resume generated per job (JD-aligned)",
      "Automated application flows from your inbox, per posting requirements",
      "Reply-assist drafts (inbox optional)",
      "Interview prep from same job context",
      "Audit trail of what was sent",
    ],
    includedLabel: "Everything in Free, plus:",
  },
  {
    name: "Business",
    monthly: "€39",
    yearly: "€31",
    blurb: "For coaches and teams running parallel candidate pipelines.",
    featured: false,
    features: [
      "Seat management",
      "Shared templates & snippets",
      "Usage and success reporting",
      "Export audit logs",
      "Custom retention options",
      "Dedicated success contact",
      "SSO-ready roadmap slots",
    ],
    includedLabel: "Everything in Pro, plus:",
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="border-b border-zinc-800 bg-black py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Choose your plan. Start today.
          </h2>
          <p className="max-w-md text-lg text-zinc-400 lg:text-right">
            Free to explore; Pro unlocks tailored resume exports and applying
            through your own email with full approval control.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div className="relative inline-flex rounded-full border border-zinc-800 bg-[#0c0c0c] p-1">
            <span
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-emerald-400 transition-all duration-200 ${
                yearly ? "left-[calc(50%+2px)]" : "left-1"
              }`}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={`relative z-10 rounded-full px-6 py-2 text-sm font-semibold ${
                !yearly ? "text-zinc-950" : "text-zinc-400"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={`relative z-10 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${
                yearly ? "text-zinc-950" : "text-zinc-400"
              }`}
            >
              Yearly
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                20% OFF
              </span>
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Ready to subscribe? Open{" "}
          <Link href="/pricing" className="font-semibold text-emerald-400 hover:underline">
            Daubo plans &amp; billing
          </Link>{" "}
          and finish checkout from your account.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-8 ${
                tier.featured
                  ? "border-emerald-500/40 bg-[#0c0c0c] shadow-[0_20px_60px_-30px_rgba(74,222,128,0.35)]"
                  : "border-zinc-800 bg-[#0c0c0c]"
              }`}
            >
              {tier.featured ? (
                <span className="absolute right-4 top-4 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-bold uppercase text-zinc-950">
                  Popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-white">
                  {yearly ? tier.yearly : tier.monthly}
                </span>
                <span className="text-sm text-zinc-500">/month</span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{tier.blurb}</p>
              <Link
                href={tier.name === "Free" ? "/auth/sign-up" : "/pricing"}
                className={`mt-8 inline-flex justify-center rounded-full py-3 text-sm font-semibold ${
                  tier.featured
                    ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                    : "border border-zinc-600 text-white hover:border-zinc-400"
                }`}
              >
                {tier.name === "Free" ? "Create account" : "Subscribe"}
              </Link>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#0c0c0c] px-3 text-xs font-medium text-zinc-500">
                    {tier.includedLabel}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 text-sm text-zinc-400">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" strokeWidth={2} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
