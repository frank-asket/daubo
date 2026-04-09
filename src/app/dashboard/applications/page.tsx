import Link from "next/link";

export default function ApplicationsPage() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-zinc-50">
        Applications
      </h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-500">
        Wire this route to your LangGraph orchestration and application state
        machine. The overview table mirrors the pipeline you show candidates.
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
