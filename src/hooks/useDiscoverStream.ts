"use client";

import { dauboBffUrl } from "@/lib/daubo-api";
import { useSseEventStream } from "@/hooks/useSseEventStream";

export type DiscoverStreamEvent = {
  total: number;
  high_fit: number;
  max_discovered_at: string | null;
};

export function useDiscoverStream(enabled = true) {
  return useSseEventStream<DiscoverStreamEvent>({
    enabled,
    url: dauboBffUrl("v1/jobs/stream"),
    eventName: "discovery_update",
    parseErrorMessage: "Could not parse live discovery update.",
    pausedMessage: "Live discovery updates are reconnecting.",
  });
}
