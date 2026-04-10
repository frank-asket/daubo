import { auth } from "@clerk/nextjs/server";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL = "X-Daubo-Internal-Key";
const USER_ID = "X-Daubo-User-Id";

type ClerkGate = { ok: true; userId: string } | { ok: false; response: NextResponse };

/** Same-origin CopilotKit calls must match dashboard auth (Clerk session). */
async function requireClerkSession(): Promise<ClerkGate> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return { ok: true, userId };
  } catch (err) {
    console.error("[copilotkit] Clerk auth() failed:", err);
    return {
      ok: false,
      response: NextResponse.json(
        {
          detail:
            "Authentication could not be verified. Check Clerk env vars on the server.",
        },
        { status: 503 },
      ),
    };
  }
}

function agUiJobSearchUrl(): string | null {
  const base = process.env.DAUBO_API_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/v1/ag-ui/job-search`;
}

/**
 * LangGraphHttpAgent merges headers at construction time only, so we build a runtime
 * per request and forward the Clerk user id to the API (same contract as /api/daubo).
 */
function createCopilotHandlerForUser(clerkUserId: string): (req: NextRequest) => Promise<Response> {
  const agentUrl = agUiJobSearchUrl();
  const secret = process.env.DAUBO_INTERNAL_API_SECRET?.trim() ?? "";

  if (!agentUrl) {
    return async () =>
      Response.json(
        { error: "DAUBO_API_URL is not configured — cannot reach the job-search agent." },
        { status: 503 },
      );
  }

  const headers: Record<string, string> = { [USER_ID]: clerkUserId };
  if (secret) headers[INTERNAL] = secret;

  const copilotRuntime = new CopilotRuntime({
    agents: {
      daubo_job_search: new LangGraphHttpAgent({
        url: agentUrl,
        headers,
      }),
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return async (req: NextRequest) => {
    const res = handleRequest(req);
    return res instanceof Promise ? res : Promise.resolve(res);
  };
}

async function dispatch(req: NextRequest): Promise<Response> {
  const gate = await requireClerkSession();
  if (!gate.ok) return gate.response;
  const handle = createCopilotHandlerForUser(gate.userId);
  return handle(req);
}

export async function GET(req: NextRequest) {
  return dispatch(req);
}

export async function POST(req: NextRequest) {
  return dispatch(req);
}

export async function PUT(req: NextRequest) {
  return dispatch(req);
}

export async function DELETE(req: NextRequest) {
  return dispatch(req);
}

export async function OPTIONS(req: NextRequest) {
  return dispatch(req);
}
