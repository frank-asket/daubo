"use client";

import { useUser } from "@clerk/nextjs";
import { Paperclip, ChevronDown } from "lucide-react";

export function QuickSwapCard({ compact }: { compact?: boolean }) {
  const { user, isLoaded } = useUser();
  const inbox =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <p className="text-sm font-semibold text-white">Apply package</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Preview — personalized resume + email, sent from your address after approval
      </p>
      <div className="mt-4 space-y-2">
        <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            From (your inbox)
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-sm text-white">
              {!isLoaded ? "…" : inbox ?? "Add an email in your Clerk account"}
            </span>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-[10px] font-semibold text-zinc-200"
            >
              Account
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <Paperclip className="h-3 w-3" />
            Attached resume
          </div>
          <p className="mt-1 truncate text-sm text-white">
            Tailored_resume<span className="text-emerald-400">_role_company</span>.pdf
          </p>
          {!compact ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              Generated for this job posting · matches JD keywords &amp; level
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Subject
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-300">
            Application — [role] — [your name]
          </p>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400 transition hover:border-emerald-400/60 hover:bg-emerald-500/15"
      >
        Approve &amp; send from inbox
      </button>
    </div>
  );
}
