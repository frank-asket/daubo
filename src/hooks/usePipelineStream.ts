"use client";

import { useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

export type PipelineStreamEvent = {
  total: number;
  max_updated_at: string | null;
  by_status: Record<string, number>;
};

export function usePipelineStream(enabled = true) {
  const [event, setEvent] = useState<PipelineStreamEvent | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const url = dauboBffUrl("v1/me/applications/stream");
    const es = new EventSource(url);
    es.addEventListener("pipeline_update", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as PipelineStreamEvent;
        setEvent(payload);
        setStreamError(null);
      } catch {
        setStreamError("Could not parse live pipeline update.");
      }
    });
    es.onerror = () => {
      setStreamError("Live pipeline updates paused. Refresh to reconnect.");
    };
    return () => {
      es.close();
    };
  }, [enabled]);

  return { event, streamError };
}
