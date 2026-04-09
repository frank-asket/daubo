import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";

const highlights = [
  "Tailored resume for every job you save",
  "Approve every email before it sends from your inbox",
  "Same workspace for applications & interview prep",
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
          Your pipeline for every sector you target.
        </p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
          Sign in to match roles worldwide, generate job-specific resumes, and keep every
          application on your terms—with a hard stop before anything goes out.
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
