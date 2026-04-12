"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Mail, Sparkles } from "lucide-react";

/** Side card on the dashboard: aligns with human-in-the-loop apply and Gmail drafts. */
export function QuickSwapCard({ compact }: { compact?: boolean }) {
  const { user, isLoaded } = useUser();
  const inbox =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <p className="text-sm font-semibold text-white">How applying works</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
        Daubo generates packages; you submit on the real site. For email-style roles, connect Gmail
        in Settings to drop a <strong className="font-medium text-zinc-400">draft</strong> in your
        inbox—nothing sends automatically.
      </p>

      <div className="mt-4 space-y-2">
        <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Your account email
          </p>
          <p className="mt-1 truncate font-mono text-sm text-white">
            {!isLoaded ? "…" : inbox ?? "—"}
          </p>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            Sign-in email for your account. Gmail drafts use a separate connection in Settings.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-emerald-400/90">
            <Sparkles className="h-3 w-3" strokeWidth={1.75} />
            Three ways to get help
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-400">
            <strong className="text-zinc-300">Coach</strong> (bottom-right) for product how-tos.{" "}
            <strong className="text-zinc-300">Web job search</strong> in the sidebar for live postings when
            enabled. Discover and prep flows use your résumé and saved jobs for tailored text—you always
            approve sends.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/50 p-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <Mail className="h-3 w-3" strokeWidth={1.75} />
            Gmail drafts
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            From <strong className="text-zinc-400">My jobs</strong> → Apply yourself → Save a
            draft in Gmail (after you connect in Settings).
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/dashboard/applications"
            className="rounded-xl border border-zinc-700 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Open my jobs
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 py-2.5 text-center text-sm font-semibold text-emerald-300 transition hover:border-emerald-500/55"
          >
            Gmail &amp; Settings
          </Link>
        </div>
      ) : (
        <Link
          href="/dashboard/applications"
          className="mt-auto rounded-xl border border-zinc-800 py-2.5 text-center text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
        >
          Apply yourself →
        </Link>
      )}
    </div>
  );
}
