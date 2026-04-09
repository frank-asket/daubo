import Link from "next/link";
import { AccountProfilePanel } from "@/components/dashboard/AccountProfilePanel";

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
        Settings
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Your Daubo account, security, and subscription live in the profile below—update
        payment method, plan, or sign-in methods in one place.
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        About Daubo plans →
      </Link>

      <div className="mt-10">
        <AccountProfilePanel />
      </div>

      <Link
        href="/dashboard"
        className="mt-10 inline-flex text-sm font-semibold text-zinc-500 hover:text-zinc-300"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
