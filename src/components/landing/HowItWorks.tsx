import Link from "next/link";
import { ChevronDown } from "lucide-react";

const steps = [
  {
    n: "1",
    title: "Add your résumé (and Gmail if you like)",
    body: "Sign in, upload or paste your experience, and optionally connect Gmail so application emails can be saved as drafts you review and send yourself.",
    mock: "signup",
  },
  {
    n: "2",
    title: "Shape materials for each role",
    body: "Save jobs you find, then get wording tuned to what each posting asks for—grounded in your real résumé, not a generic blast.",
    mock: "fund",
  },
  {
    n: "3",
    title: "Apply on the real site",
    body: "You open the employer or LinkedIn posting and submit there yourself. For email applications, start from a Gmail draft if you created one—Daubo never auto-submits.",
    mock: "trade",
  },
] as const;

function MockSignup() {
  return (
    <div className="mt-6 space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3">
      <div className="h-8 rounded-lg bg-zinc-900/80 px-2 text-[10px] leading-8 text-zinc-500">
        Resume PDF uploaded
      </div>
      <div className="flex h-8 items-center justify-between rounded-lg bg-zinc-900/80 px-2 text-[10px] text-zinc-400">
        <span>Inbox connected</span>
        <span className="text-emerald-400">Active</span>
      </div>
    </div>
  );
}

function MockFund() {
  return (
    <div className="mt-6 space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3">
      <p className="text-[10px] text-zinc-500">Output for Metro Health · ICU Nurse</p>
      <div className="flex h-9 items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/60 px-2">
        <span className="truncate text-xs text-white">Resume_Alex_MetroHealth_ICUNurse.pdf</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
          Tailored
          <ChevronDown className="h-3 w-3 opacity-60" />
        </span>
      </div>
    </div>
  );
}

function MockTrade() {
  return (
    <div className="mt-6 space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3">
      <div className="flex items-center justify-between rounded-lg bg-zinc-900/50 px-2 py-2 text-[10px] text-zinc-400">
        <span>From</span>
        <span className="font-mono text-zinc-200">you@domain.com</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-zinc-900/50 px-2 py-2 text-[11px]">
        <span className="text-zinc-400">Status</span>
        <span className="text-emerald-400">Draft ready</span>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-zinc-800 bg-black py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 max-w-xl text-lg text-zinc-400">
              From your résumé to <span className="text-zinc-300">saved roles</span> to{" "}
              <span className="text-zinc-300">clear application materials per job</span>—with you
              choosing when and where to hit submit.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Create account now <span aria-hidden>&gt;</span>
          </Link>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.n}
              className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6"
            >
              <span className="text-3xl font-semibold text-zinc-700">{step.n}</span>
              <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{step.body}</p>
              {step.mock === "signup" ? <MockSignup /> : null}
              {step.mock === "fund" ? <MockFund /> : null}
              {step.mock === "trade" ? <MockTrade /> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
