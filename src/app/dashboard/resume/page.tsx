import Link from "next/link";

export default function ResumePage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-zinc-50">
        Resume
      </h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-500">
        Placeholder for PDF upload, parsed JSON editor, and variant history per
        job.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex text-sm font-semibold text-[var(--mint)] hover:underline"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
