import { expect, test } from "@playwright/test";

const apiBase = (process.env.DAUBO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

test("backend exposes health", async ({ request }) => {
  const res = await request.get(`${apiBase}/health`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status?: string };
  expect(body.status).toBe("ok");
});
