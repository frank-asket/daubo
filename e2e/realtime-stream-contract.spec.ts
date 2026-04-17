import { expect, test } from "@playwright/test";

test.describe("realtime stream contract", () => {
  test.skip(
    !process.env.E2E_REALTIME_STREAM,
    "Set E2E_REALTIME_STREAM=1 with a running API stack and auth headers.",
  );

  const base = (process.env.DAUBO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const userId = (process.env.E2E_USER_ID ?? "e2e-realtime-user").trim();
  const secret = (process.env.E2E_INTERNAL_KEY ?? process.env.DAUBO_INTERNAL_API_SECRET ?? "").trim();

  const headers: Record<string, string> = {
    "X-Daubo-User-Id": userId,
  };
  if (secret) headers["X-Daubo-Internal-Key"] = secret;

  test("applications/jobs/agents stream expose expected SSE headers and first event", async ({ request }) => {
    const endpoints = [
      { path: "/v1/me/applications/stream", eventName: "pipeline_update" },
      { path: "/v1/jobs/stream", eventName: "discovery_update" },
      { path: "/v1/agents/status", eventName: "agent_status" },
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(`${base}${endpoint.path}`, {
        headers: { ...headers, accept: "text/event-stream" },
      });

      expect(res.ok(), `stream ${endpoint.path} failed`).toBeTruthy();
      expect(res.headers()["cache-control"]).toBe("no-cache");
      expect(res.headers()["connection"]).toBe("keep-alive");
      expect(res.headers()["x-accel-buffering"]).toBe("no");

      const body = await res.text();
      expect(body).toContain(`event: ${endpoint.eventName}`);
      expect(body).toContain("data:");
    }
  });
});
