import { expect, test, type APIRequestContext } from "@playwright/test";

test.describe("full apply flow", () => {
  test.skip(
    !process.env.E2E_FULL_APPLY,
    "Set E2E_FULL_APPLY=1 with a running apps/api stack + database.",
  );

  const base = (process.env.DAUBO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const userId = (process.env.E2E_USER_ID ?? "e2e-apply-user").trim();
  const secret = (process.env.E2E_INTERNAL_KEY ?? process.env.DAUBO_INTERNAL_API_SECRET ?? "").trim();
  const allowLiveGeneration = process.env.E2E_ENABLE_PACKAGE_GENERATION === "1";

  const headers: Record<string, string> = {
    "X-Daubo-User-Id": userId,
  };
  if (secret) headers["X-Daubo-Internal-Key"] = secret;

  async function uploadResume(request: APIRequestContext) {
    const resumeText = [
      "Senior software engineer",
      "8 years building FastAPI and Next.js apps",
      "Experience: PostgreSQL, Redis, Playwright, distributed systems",
    ].join("\n");

    const resumeUpload = await request.post(`${base}/v1/me/resume/upload`, {
      headers,
      multipart: {
        file: {
          name: "resume.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(resumeText, "utf-8"),
        },
      },
    });
    expect(resumeUpload.ok(), `resume upload failed: ${await resumeUpload.text()}`).toBeTruthy();
  }

  async function createPendingApproval(
    request: APIRequestContext,
  ): Promise<{ applicationId: string; approvalId: string; coverLetter?: string }> {
    const createApp = await request.post(`${base}/v1/me/applications`, {
      headers: { ...headers, "content-type": "application/json" },
      data: {
        title: "Senior Backend Engineer",
        company: "Daubo Labs",
        location: "Paris",
        status: "draft",
        job_url: "https://example.com/jobs/senior-backend-engineer",
        apply_channel: "email",
        job_description:
          "Build async APIs with FastAPI, maintain observability, and improve application automation.",
      },
    });
    expect(createApp.ok(), `application create failed: ${await createApp.text()}`).toBeTruthy();
    const created = (await createApp.json()) as { id: string };
    expect(created.id).toBeTruthy();

    const packageRes = await request.post(
      `${base}/v1/me/applications/${encodeURIComponent(created.id)}/application-package`,
      {
        headers: { ...headers, "content-type": "application/json" },
        data: {},
      },
    );

    if (!packageRes.ok()) {
      const msg = await packageRes.text();
      if (!allowLiveGeneration && (packageRes.status() === 503 || packageRes.status() === 502)) {
        test.skip(
          true,
          "Package generation unavailable (LLM provider not configured/reachable). Set E2E_ENABLE_PACKAGE_GENERATION=1 once API LLM connectivity is healthy.",
        );
      }
      throw new Error(`application-package failed: ${packageRes.status()} ${msg}`);
    }

    const packageBody = (await packageRes.json()) as {
      id: string;
      status: string;
      package_draft?: { cover_letter?: string };
    };
    expect(packageBody.id).toBe(created.id);
    expect(packageBody.status).toBe("package_ready");

    const approvalsRes = await request.get(
      `${base}/v1/me/approvals?application_id=${encodeURIComponent(created.id)}`,
      { headers },
    );
    expect(approvalsRes.ok(), `approvals fetch failed: ${await approvalsRes.text()}`).toBeTruthy();
    const approvals = (await approvalsRes.json()) as Array<{ id: string }>;
    expect(approvals.length).toBeGreaterThan(0);

    return {
      applicationId: created.id,
      approvalId: approvals[0].id,
      coverLetter: packageBody.package_draft?.cover_letter,
    };
  }

  test("resume upload through approval with idempotent replay", async ({ request }) => {
    const createdApplicationIds: string[] = [];

    try {
      await uploadResume(request);
      const pending = await createPendingApproval(request);
      createdApplicationIds.push(pending.applicationId);

      const idempotencyKey = `e2e-approve-${pending.approvalId}`;
      const approvePayload = {
        cover_letter: pending.coverLetter ?? "Thanks for reviewing. This is an E2E approval confirmation.",
      };

      const approveRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/approve`,
        {
          headers: {
            ...headers,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          data: approvePayload,
        },
      );
      expect(approveRes.ok(), `approval failed: ${await approveRes.text()}`).toBeTruthy();
      const approveBody = (await approveRes.json()) as {
        application?: { id: string; status: string };
      };
      expect(approveBody.application?.id).toBe(pending.applicationId);
      expect(approveBody.application?.status).toBe("applied");

      const replayRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/approve`,
        {
          headers: {
            ...headers,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          data: approvePayload,
        },
      );
      expect(replayRes.ok(), `approval replay failed: ${await replayRes.text()}`).toBeTruthy();
      const replayBody = (await replayRes.json()) as {
        application?: { id: string; status: string };
      };
      expect(replayBody.application?.id).toBe(pending.applicationId);
      expect(replayBody.application?.status).toBe("applied");
    } finally {
      for (const id of createdApplicationIds) {
        await request.delete(`${base}/v1/me/applications/${encodeURIComponent(id)}`, { headers });
      }
    }
  });

  test("reject approval transitions application to closed", async ({ request }) => {
    const createdApplicationIds: string[] = [];

    try {
      await uploadResume(request);
      const pending = await createPendingApproval(request);
      createdApplicationIds.push(pending.applicationId);

      const idempotencyKey = `e2e-reject-${pending.approvalId}`;

      const rejectRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/reject`,
        {
          headers: {
            ...headers,
            "Idempotency-Key": idempotencyKey,
          },
        },
      );
      expect(rejectRes.ok(), `reject failed: ${await rejectRes.text()}`).toBeTruthy();
      const rejectBody = (await rejectRes.json()) as { id: string; status: string };
      expect(rejectBody.id).toBe(pending.applicationId);
      expect(rejectBody.status).toBe("closed");

      const replayRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/reject`,
        {
          headers: {
            ...headers,
            "Idempotency-Key": idempotencyKey,
          },
        },
      );
      expect(replayRes.ok(), `reject replay failed: ${await replayRes.text()}`).toBeTruthy();
      const replayBody = (await replayRes.json()) as { id: string; status: string };
      expect(replayBody.id).toBe(pending.applicationId);
      expect(replayBody.status).toBe("closed");
    } finally {
      for (const id of createdApplicationIds) {
        await request.delete(`${base}/v1/me/applications/${encodeURIComponent(id)}`, { headers });
      }
    }
  });

  test("approve with same idempotency key but different payload returns conflict", async ({ request }) => {
    const createdApplicationIds: string[] = [];

    try {
      await uploadResume(request);
      const pending = await createPendingApproval(request);
      createdApplicationIds.push(pending.applicationId);

      const idempotencyKey = `e2e-approve-conflict-${pending.approvalId}`;
      const firstPayload = {
        cover_letter: pending.coverLetter ?? "First E2E approval payload.",
      };
      const secondPayload = {
        cover_letter: "Second payload should conflict for same idempotency key.",
      };

      const firstApproveRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/approve`,
        {
          headers: {
            ...headers,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          data: firstPayload,
        },
      );
      expect(firstApproveRes.ok(), `first approval failed: ${await firstApproveRes.text()}`).toBeTruthy();

      const conflictingApproveRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/approve`,
        {
          headers: {
            ...headers,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          data: secondPayload,
        },
      );
      expect(conflictingApproveRes.status(), `unexpected response: ${await conflictingApproveRes.text()}`).toBe(
        409,
      );
      const conflictBody = (await conflictingApproveRes.json()) as {
        detail?: { code?: string; message?: string };
      };
      expect(conflictBody.detail?.code).toBe("idempotency_key_reused_with_different_payload");
      expect(conflictBody.detail?.message).toContain("Idempotency-Key was already used");
    } finally {
      for (const id of createdApplicationIds) {
        await request.delete(`${base}/v1/me/applications/${encodeURIComponent(id)}`, { headers });
      }
    }
  });

  test("approve twice without idempotency key fails second call as no longer pending", async ({
    request,
  }) => {
    const createdApplicationIds: string[] = [];

    try {
      await uploadResume(request);
      const pending = await createPendingApproval(request);
      createdApplicationIds.push(pending.applicationId);

      const approvePayload = {
        cover_letter: pending.coverLetter ?? "Non-idempotent approval payload.",
      };

      const firstApproveRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/approve`,
        {
          headers: {
            ...headers,
            "content-type": "application/json",
          },
          data: approvePayload,
        },
      );
      expect(firstApproveRes.ok(), `first approval failed: ${await firstApproveRes.text()}`).toBeTruthy();

      const secondApproveRes = await request.post(
        `${base}/v1/me/approvals/${encodeURIComponent(pending.approvalId)}/approve`,
        {
          headers: {
            ...headers,
            "content-type": "application/json",
          },
          data: approvePayload,
        },
      );
      expect(secondApproveRes.status(), `unexpected response: ${await secondApproveRes.text()}`).toBe(409);
      const secondApproveBody = (await secondApproveRes.json()) as { detail?: string };
      expect(secondApproveBody.detail).toContain("no longer pending");
    } finally {
      for (const id of createdApplicationIds) {
        await request.delete(`${base}/v1/me/applications/${encodeURIComponent(id)}`, { headers });
      }
    }
  });
});
