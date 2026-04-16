import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL = "X-Daubo-Internal-Key";
const USER_ID = "X-Daubo-User-Id";

/** Strip trailing slashes and accidental `/v1` suffix (caller already sends `v1/...` in segments). */
function normalizeApiBase(base: string): string {
  let b = base.trim().replace(/\/+$/, "");
  if (b.endsWith("/v1")) {
    b = b.slice(0, -3).replace(/\/+$/, "");
  }
  return b;
}

function targetUrl(base: string, segments: string[], search: string): string {
  const root = normalizeApiBase(base);
  if (!segments.length) return `${root}${search}`;
  const path = segments.map((s) => encodeURIComponent(s)).join("/");
  return `${root}/${path}${search}`;
}

/** Public proxy paths (no signed-in Daubo session required). */
function isPublicProxy(method: string, pathKey: string): boolean {
  return method === "GET" && (pathKey === "v1/health" || pathKey === "health");
}

async function handle(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const base = process.env.DAUBO_API_URL;
  if (!base?.trim()) {
    return NextResponse.json(
      { error: "DAUBO_API_URL is not configured on the server" },
      { status: 503 },
    );
  }

  const pathKey = segments.join("/");
  let clerkUserId: string | null = null;
  if (!isPublicProxy(req.method, pathKey)) {
    try {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      clerkUserId = userId;
    } catch (err) {
      console.error("[daubo proxy] Clerk auth() failed:", err);
      return NextResponse.json(
        { detail: "Authentication could not be verified. Check Clerk env vars on the server." },
        { status: 503 },
      );
    }
  }

  const secret = process.env.DAUBO_INTERNAL_API_SECRET;
  const url = targetUrl(base, segments, req.nextUrl.search);

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const idem = req.headers.get("idempotency-key");
  if (idem?.trim()) headers.set("Idempotency-Key", idem.trim());
  if (secret) headers.set(INTERNAL, secret);
  if (clerkUserId) headers.set(USER_ID, clerkUserId);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return NextResponse.json({ error: "Upstream API unreachable" }, { status: 502 });
  }

  const resCt = upstream.headers.get("content-type") || "";
  const rid = upstream.headers.get("x-request-id");

  if (resCt.includes("text/event-stream") && upstream.body) {
    const out = new NextResponse(upstream.body, { status: upstream.status });
    if (rid) out.headers.set("x-request-id", rid);
    out.headers.set("content-type", resCt);
    out.headers.set("cache-control", "no-cache");
    out.headers.set("connection", "keep-alive");
    const xab = upstream.headers.get("x-accel-buffering");
    if (xab) out.headers.set("x-accel-buffering", xab);
    return out;
  }

  const out = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status });
  if (rid) out.headers.set("x-request-id", rid);
  if (resCt) out.headers.set("content-type", resCt);
  const cd = upstream.headers.get("content-disposition");
  if (cd) out.headers.set("content-disposition", cd);
  return out;
}

type Ctx = { params: Promise<{ path?: string[] }> | { path?: string[] } };

async function segmentsFrom(ctx: Ctx): Promise<string[]> {
  const p = await Promise.resolve(ctx.params);
  return p.path ?? [];
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, await segmentsFrom(ctx));
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, await segmentsFrom(ctx));
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, await segmentsFrom(ctx));
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(req, await segmentsFrom(ctx));
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, await segmentsFrom(ctx));
}
