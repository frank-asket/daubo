import Link from "next/link";
import { Suspense } from "react";
import { AccountProfilePanel } from "@/components/dashboard/AccountProfilePanel";
import { DashboardPrivacyNoteCard } from "@/components/dashboard/DashboardPrivacyNoteCard";
import { GmailConnectCard } from "@/components/dashboard/GmailConnectCard";

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
        Settings
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Connect Gmail for drafts, and manage your account, security, and subscription in one place.
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        About Daubo plans →
      </Link>

      <div className="mt-10 space-y-8">
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
        className="mt-10 inline-flex text-sm font-semibold text-zinc-500 hover:text-zinc-300"
      >
        ← Back to home
      </Link>
    </div>
  );
}
