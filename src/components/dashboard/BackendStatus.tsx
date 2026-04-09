async function fetchHealth(): Promise<{ ok: boolean; message: string }> {
  const base = process.env.DAUBO_API_URL?.trim();
  if (!base) {
    return { ok: false, message: "Daubo API URL not configured (DAUBO_API_URL)" };
  }
  try {
    const url = `${base.replace(/\/+$/, "")}/health`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (res.ok) return { ok: true, message: "API reachable" };
    return { ok: false, message: `API returned ${res.status}` };
  } catch {
    return { ok: false, message: "API unreachable" };
  }
}

export async function BackendStatus() {
  const { ok, message } = await fetchHealth();
  return (
    <p
      className={`rounded-lg border px-3 py-2 text-xs ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-200"
      }`}
    >
      <span className="font-semibold">Backend: </span>
      {message}
    </p>
  );
}
