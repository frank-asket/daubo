import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white">Support</h1>
      <p className="mt-2 text-sm text-zinc-500">Placeholder — help center.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-emerald-400">
        ← Dashboard
      </Link>
    </div>
  );
}
