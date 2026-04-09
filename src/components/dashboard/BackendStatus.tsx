async function fetchHealth(): Promise<{ ok: boolean }> {
  const base = process.env.DAUBO_API_URL?.trim();
  if (!base) {
    return { ok: false };
  }
  try {
    const url = `${base.replace(/\/+$/, "")}/health`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (res.ok) return { ok: true };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Only surfaces problems—members shouldn’t see “API reachable” developer noise. */
export async function BackendStatus() {
  const { ok } = await fetchHealth();
  if (ok) return null;
  return (
    <p
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
      role="alert"
    >
      <span className="font-semibold">We couldn’t connect to Daubo just now.</span> Check your
      internet connection and refresh the page. If this keeps happening, try again later or contact
      support.
    </p>
  );
}
