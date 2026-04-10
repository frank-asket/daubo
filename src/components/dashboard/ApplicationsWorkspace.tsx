"use client";

import { useState } from "react";
import { ApplicationsBoard } from "@/components/dashboard/ApplicationsBoard";
import { JobDiscoverPanel } from "@/components/dashboard/JobDiscoverPanel";

/** My jobs page: discover + board; bump key so the list refetches after saves from discover. */
export function ApplicationsWorkspace() {
  const [boardKey, setBoardKey] = useState(0);

  return (
    <div className="space-y-8">
      <JobDiscoverPanel
        onDiscoveryComplete={() => setBoardKey((k) => k + 1)}
        onAddedToPipeline={() => setBoardKey((k) => k + 1)}
      />
      <ApplicationsBoard key={boardKey} />
    </div>
  );
}
