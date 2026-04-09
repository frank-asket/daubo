import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export const metadata = {
  title: "Plans — Daubo",
  description: "Choose a Daubo plan and manage your subscription from your account.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-white">
            Daubo
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Plans &amp; subscription
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-400">
          Pick the Daubo tier that fits how aggressively you want agents to match and apply on
          your behalf. Subscribe from your account settings, change or cancel when you need to.
        </p>

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-white">How billing works</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Checkout and plan management live in your Daubo profile (Settings → account).
            After you choose a plan, you can upgrade, downgrade, or update payment
            details from the same place.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <SignedOut>
            <Link
              href="/auth/sign-in"
              className="inline-flex rounded-full border border-zinc-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:border-zinc-400"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_32px_-8px_rgba(74,222,128,0.5)] transition hover:bg-emerald-300"
            >
              Create account
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard/settings"
              className="rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            >
              Manage subscription in settings
            </Link>
          </SignedIn>
        </div>

        <p className="mt-10 text-center text-xs text-zinc-600">
          Questions about plans? Open Support from your Daubo dashboard.
        </p>
      </main>
    </div>
  );
}
