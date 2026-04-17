"use client";

import { useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

export type DiscoverStreamEvent = {
  total: number;
  high_fit: number;
  max_discovered_at: string | null;
};

export function useDiscoverStream(enabled = true) {
  const [event, setEvent] = useState<DiscoverStreamEvent | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const url = dauboBffUrl("v1/jobs/stream");
    const es = new EventSource(url);
    es.addEventListener("discovery_update", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as DiscoverStreamEvent;
        setEvent(payload);
        setStreamError(null);
      } catch {
        setStreamError("Could not parse live discovery update.");
      }
    });
    es.onerror = () => {
      setStreamError("Live discovery updates paused. Refresh to reconnect.");
    };
    return () => {
      es.close();
    };
  }, [enabled]);

  return { event, streamError };
}
