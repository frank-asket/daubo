import Link from "next/link";

export function SupportOverview() {
  return (
    <div className="max-w-xl space-y-6">
      <p className="text-sm text-zinc-500">
        We are building Daubo support around fast answers and clear docs. Start with the FAQ on
        the home page, then reach out if you are stuck.
      </p>
      <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6">
        <h2 className="text-sm font-semibold text-white">Self-serve</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          <li>
            <Link href="/#faq" className="text-emerald-400 hover:underline">
              FAQ on the Daubo homepage
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="text-emerald-400 hover:underline">
              Plans &amp; billing
            </Link>
          </li>
          <li>
            <Link href="/dashboard/settings" className="text-emerald-400 hover:underline">
              Account &amp; subscription settings
            </Link>
          </li>
        </ul>
      </div>
      <p className="text-xs text-zinc-600">
        For product issues, use the contact path your Daubo workspace administrator provides.
      </p>
    </div>
  );
}
