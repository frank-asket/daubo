import { test } from "@playwright/test";

test.describe("full apply flow", () => {
  test.skip(
    !process.env.E2E_FULL_APPLY,
    "Set E2E_FULL_APPLY=1 with a running stack, Clerk test user, and database (see Phase 7 roadmap).",
  );

  test("resume upload through approval (placeholder)", async () => {
    // Extend: sign in, upload resume, drive autopilot, open approvals, assert draft preview.
  });
});
