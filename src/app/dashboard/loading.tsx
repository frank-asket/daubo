export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-12">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400"
        aria-hidden
      />
      <p className="text-sm text-zinc-500">Loading your workspace…</p>
    </div>
  );
}
