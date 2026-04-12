"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useEffect, useState } from "react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { dauboBffUrl } from "@/lib/daubo-api";

export function DashboardCopilotKit({ children }: { children: React.ReactNode }) {
  const { stats, statsReady } = useDashboardStats();
  const [resumeExcerpt, setResumeExcerpt] = useState<string | null>(null);

  const showAgent = Boolean(stats?.agents?.job_web_search_copilot);

  useEffect(() => {
    if (!showAgent || !stats?.has_resume) {
      setResumeExcerpt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(dauboBffUrl("v1/me/discover/hints"), { credentials: "same-origin" });
        if (!r.ok) return;
        const j = (await r.json()) as { resume_excerpt?: string };
        const ex = j.resume_excerpt?.trim();
        if (!cancelled && ex) setResumeExcerpt(ex.slice(0, 8000));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAgent, stats?.has_resume]);

  if (!statsReady || !showAgent) {
    return <>{children}</>;
  }

  const instructions = resumeExcerpt?.trim()
    ? [
        "Résumé excerpt for grounding (not job ads):",
        "",
        resumeExcerpt.trim(),
      ].join("\n")
    : "No résumé excerpt is loaded yet. Ask the user for target role, region or remote preference, and seniority before searching.";

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="daubo_job_search">
      {/*
        CopilotSidebar must wrap the dashboard: it renders children inside `.copilotKitModalChildrenWrapper`
        and the chat chrome beside them. Sibling `{children}` under CopilotKit leaves that wrapper empty and
        breaks the intended flex/layout relationship with `.copilotKitSidebarContentWrapper`.
      */}
      <CopilotSidebar
        defaultOpen={false}
        instructions={instructions}
        labels={{
          title: "Web job search",
          initial:
            "I search live job postings on the web (not your email). Your résumé excerpt may be included so results match your background. Ask for a role and location—or say “remote”.",
          placeholder: "e.g. Senior ICU nurse jobs in Melbourne, or remote SRE with Kubernetes",
        }}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}
