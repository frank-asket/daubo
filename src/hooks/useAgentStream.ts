"use client";

import { dauboBffUrl } from "@/lib/daubo-api";
import { useSseEventStream } from "@/hooks/useSseEventStream";

export type AgentStatusEvent = {
  last_orchestration_at: string | null;
  agents: {
    agent_id: string;
    name: string;
    description: string;
    state: "active" | "working" | "idle";
    last_run_at?: string | null;
  }[];
};

export function useAgentStream(enabled = true) {
  return useSseEventStream<AgentStatusEvent>({
    enabled,
    url: dauboBffUrl("v1/agents/status"),
    eventName: "agent_status",
    parseErrorMessage: "Could not parse live agent update.",
    pausedMessage: "Live updates are reconnecting.",
  });
}
