import Link from "next/link";
import { bookingUrl, supportEmail } from "@/lib/customer-config";

export function SupportOverview() {
  const email = supportEmail();
  const book = bookingUrl();

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-sm text-zinc-500">
        Start with the FAQ and plans below. On any dashboard page, use the green{" "}
        <strong className="text-zinc-400">Coach</strong> button for quick answers about using Daubo.
      </p>

      {email || book ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-sm font-semibold text-white">Talk to us</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {email ? (
              <li>
                Email:{" "}
                <a
                  href={`mailto:${encodeURIComponent(email)}`}
                  className="font-medium text-emerald-400 hover:underline"
                >
                  {email}
                </a>
              </li>
            ) : null}
            {book ? (
              <li>
                <a href={book} target="_blank" rel="noreferrer" className="font-medium text-emerald-400 hover:underline">
                  Schedule a conversation
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

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

      <details className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-5 py-4 text-sm">
        <summary className="cursor-pointer font-semibold text-white">
          Track applications in Google Sheets (optional)
        </summary>
        <div className="mt-3 space-y-3 text-zinc-400">
          <p>
            Daubo can export your saved jobs as a <strong className="text-zinc-300">CSV</strong> from{" "}
            <Link href="/dashboard/applications" className="text-emerald-400 hover:underline">
              My jobs
            </Link>
            —open or import that file in Google Sheets for your own pipeline.
          </p>
          <p>
            For deeper automation (for example logging when you label Gmail messages), you can use{" "}
            <strong className="text-zinc-300">Google Apps Script</strong> inside a sheet you own. That
            runs in <em>your</em> Google account, not on Daubo&apos;s servers. Ask the Coach for a
            starter prompt, or search for &ldquo;Gmail to Sheets job tracker Apps Script.&rdquo;
          </p>
          <p className="text-xs text-zinc-600">
            Daubo does not auto-submit applications on LinkedIn or employer sites—you stay in control of
            every apply action.
          </p>
        </div>
      </details>

      <p className="text-xs text-zinc-600">
        On a company or school plan, use the contact channel your administrator gave you.
      </p>
    </div>
  );
}
