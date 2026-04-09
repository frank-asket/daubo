import Link from "next/link";
import { ChevronDown } from "lucide-react";

const steps = [
  {
    n: "1",
    title: "Connect profile & inbox",
    body: "Sign in to Daubo, upload your resume PDF, and connect your inbox when you want sends to go from your address.",
    mock: "signup",
  },
  {
    n: "2",
    title: "Worldwide match & tailor",
    body: "Multi-agent matching pairs your resume with relevant offers globally, scores fit, then drafts a resume variant and application package tuned to that job's posted requirements—not a one-size-fits-all PDF.",
    mock: "fund",
  },
  {
    n: "3",
    title: "Apply as you",
    body: "Outbound email and attachments are prepared to satisfy each posting; when your inbox is connected, sends can go from your address so employers always see you.",
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
        <span className="text-emerald-400">Ready to send</span>
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
              From your resume to{" "}
              <span className="text-zinc-300">agent-matched offers worldwide</span> to a{" "}
              <span className="text-zinc-300">requirement-aligned package per job</span>—
              without you manually searching boards for each role.
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
