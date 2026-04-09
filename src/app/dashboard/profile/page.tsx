import Link from "next/link";
import { ProfileOverview } from "@/components/dashboard/ProfileOverview";

export default function ProfilePage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Profile</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        How you appear when signed in to Daubo.
      </p>
      <div className="mt-8">
        <ProfileOverview />
      </div>
      <Link
        href="/dashboard"
        className="mt-10 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
