"use client";

import { useState } from "react";
import { ApplicationsBoard } from "@/components/dashboard/ApplicationsBoard";

/** Pipeline page: board only; bump key so the list can be refreshed from future actions. */
export function ApplicationsWorkspace() {
  const [boardKey, setBoardKey] = useState(0);

  return (
    <div className="space-y-8">
      <ApplicationsBoard key={boardKey} />
    </div>
  );
}
