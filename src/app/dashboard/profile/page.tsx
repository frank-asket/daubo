import Link from "next/link";
import { ProfileOverview } from "@/components/dashboard/ProfileOverview";

export default function ProfilePage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-zinc-800 bg-[#080808] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Your account identity from sign-in, plus private uploads that strengthen Daubo&apos;s drafts
          (certificates, degrees, licenses).
        </p>
      </section>
      <div>
        <ProfileOverview />
      </div>
      <Link
        href="/dashboard"
        className="inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
