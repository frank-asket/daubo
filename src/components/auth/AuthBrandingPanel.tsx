import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";

const highlights = [
  "One place for jobs you’re pursuing",
  "Suggestions tied to each posting’s wording",
  "Interview practice from the same context",
];

export function AuthBrandingPanel() {
  return (
    <aside className="relative flex flex-col justify-between overflow-hidden border-b border-zinc-800/80 bg-[#050505] px-8 py-10 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-12 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
      >
        <div className="absolute -left-1/4 top-0 h-80 w-80 rounded-full bg-emerald-500/20 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-600/10 blur-[80px]" />
      </div>

      <div className="relative">
        <Logo href="/" />
        <p className="mt-10 text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
          Your experience stays yours—we help you show it clearly.
        </p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
          Sign in to track roles, get application wording that matches what employers ask for, and prep
          for interviews. You stay in control: real sites for applying, drafts—not auto-send—for email.
        </p>
        <ul className="mt-10 space-y-3">
          {highlights.map((line) => (
            <li key={line} className="flex gap-3 text-sm text-zinc-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-12 text-xs text-zinc-600 lg:mt-0">
        Need the marketing site?{" "}
        <Link href="/" className="font-medium text-emerald-400 hover:text-emerald-300">
          Back to daubo.com home
        </Link>
      </p>
    </aside>
  );
}
