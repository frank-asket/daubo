import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agUiJobSearchUrl(): string | null {
  const base = process.env.DAUBO_API_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/v1/ag-ui/job-search`;
}

function createCopilotHandler(): (req: NextRequest) => Promise<Response> {
  const agentUrl = agUiJobSearchUrl();
  const secret = process.env.DAUBO_INTERNAL_API_SECRET ?? "";

  if (!agentUrl) {
    return async (_req: NextRequest) =>
      Response.json(
        { error: "DAUBO_API_URL is not configured — cannot reach the job-search agent." },
        { status: 503 },
      );
  }

  const copilotRuntime = new CopilotRuntime({
    agents: {
      daubo_job_search: new LangGraphHttpAgent({
        url: agentUrl,
        ...(secret ? { headers: { "X-Daubo-Internal-Key": secret } } : {}),
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

const handleRequest = createCopilotHandler();

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}

export async function OPTIONS(req: NextRequest) {
  return handleRequest(req);
}
