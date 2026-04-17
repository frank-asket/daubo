"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { domainApi } from "@/lib/domain-api";
import {
  useDomainAgentsStore,
  useDomainApprovalsStore,
  useDomainJobsStore,
  useDomainPipelineStore,
} from "@/stores/domainStores";

export function useDomainJobs(params: {
  min_fit?: number;
  location?: string;
  page?: number;
  page_size?: number;
} = {}) {
  const setJobs = useDomainJobsStore((s) => s.setJobs);
  const swr = useSWR(
    ["domain-jobs", params.min_fit ?? 0, params.location ?? "", params.page ?? 1, params.page_size ?? 20],
    () => domainApi.jobs.list(params),
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );
  useEffect(() => {
    if (!swr.data) return;
    setJobs(swr.data.items, swr.data.total);
  }, [setJobs, swr.data]);
  return swr;
}

export function useDomainApplications() {
  const setApplications = useDomainPipelineStore((s) => s.setApplications);
  const swr = useSWR("domain-applications", () => domainApi.applications.list(), {
    revalidateOnFocus: true,
  });
  useEffect(() => {
    if (!swr.data) return;
    setApplications(swr.data);
  }, [setApplications, swr.data]);
  return swr;
}

export function useDomainApprovals(applicationId?: string) {
  const setApprovals = useDomainApprovalsStore((s) => s.setApprovals);
  const swr = useSWR(
    ["domain-approvals", applicationId ?? ""],
    () => domainApi.approvals.list(applicationId),
    { revalidateOnFocus: true, refreshInterval: 15_000 },
  );
  useEffect(() => {
    if (!swr.data) return;
    setApprovals(swr.data);
  }, [setApprovals, swr.data]);
  return swr;
}

export function useDomainAgentStatus() {
  const setAgents = useDomainAgentsStore((s) => s.setAgents);
  const swr = useSWR("domain-agent-status", () => domainApi.agents.status(), {
    revalidateOnFocus: true,
    refreshInterval: 20_000,
  });
  useEffect(() => {
    if (!swr.data) return;
    setAgents(swr.data.agents);
  }, [setAgents, swr.data]);
  return swr;
}
