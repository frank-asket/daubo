import { redirect } from "next/navigation";

function queryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => u.append(k, x));
    else u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export default function LegacySignUpRedirect({
  params,
  searchParams,
}: {
  params: { "sign-up"?: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const parts = params["sign-up"] ?? [];
  const suffix = parts.length ? `/${parts.join("/")}` : "";
  redirect(`/auth/sign-up${suffix}${queryString(searchParams)}`);
}
