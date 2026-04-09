"use client";

import { UserProfile } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

/** Daubo account & subscription UI (hosted profile experience). */
export function AccountProfilePanel() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0c]">
      <UserProfile appearance={clerkAppearance} routing="hash" />
    </div>
  );
}
