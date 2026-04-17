"use client";

import { dauboBffUrl } from "@/lib/daubo-api";
import { useSseEventStream } from "@/hooks/useSseEventStream";

export type PipelineStreamEvent = {
  total: number;
  max_updated_at: string | null;
  by_status: Record<string, number>;
};

export function usePipelineStream(enabled = true) {
  return useSseEventStream<PipelineStreamEvent>({
    enabled,
    url: dauboBffUrl("v1/me/applications/stream"),
    eventName: "pipeline_update",
    parseErrorMessage: "Could not parse live pipeline update.",
    pausedMessage: "Live pipeline updates are reconnecting.",
  });
}
