import Link from "next/link";

export default function ProfilePage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white">Profile</h1>
      <p className="mt-2 text-sm text-zinc-500">Placeholder — user profile.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-emerald-400">
        ← Dashboard
      </Link>
    </div>
  );
}
