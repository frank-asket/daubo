"use client";

import { useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

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
  const [event, setEvent] = useState<AgentStatusEvent | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const url = dauboBffUrl("v1/agents/status");
    const es = new EventSource(url);
    es.addEventListener("agent_status", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as AgentStatusEvent;
        setEvent(payload);
        setStreamError(null);
      } catch {
        setStreamError("Could not parse live agent update.");
      }
    });
    es.onerror = () => {
      setStreamError("Live updates paused. Refresh to reconnect.");
    };
    return () => {
      es.close();
    };
  }, [enabled]);

  return { event, streamError };
}
