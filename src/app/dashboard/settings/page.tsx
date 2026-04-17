import Link from "next/link";
import { Suspense } from "react";
import { AccountProfilePanel } from "@/components/dashboard/AccountProfilePanel";
import { DashboardPrivacyNoteCard } from "@/components/dashboard/DashboardPrivacyNoteCard";
import { GmailConnectCard } from "@/components/dashboard/GmailConnectCard";

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-zinc-800 bg-[#080808] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Account and integrations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Connect Gmail for drafts, and manage your profile, security, and subscription in one place.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
        >
          About Daubo plans →
        </Link>
      </section>

      <div className="space-y-8">
        <DashboardPrivacyNoteCard />
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6 text-sm text-zinc-500">
              Loading settings…
            </div>
          }
        >
          <GmailConnectCard />
        </Suspense>
        <AccountProfilePanel />
      </div>

      <Link
        href="/dashboard"
        className="inline-flex text-sm font-semibold text-zinc-500 hover:text-zinc-300"
      >
        ← Back to home
      </Link>
    </div>
  );
}
