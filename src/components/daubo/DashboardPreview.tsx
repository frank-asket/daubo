import { Bell, Search } from "lucide-react";
import { DauboSidebar } from "@/components/daubo/DauboSidebar";
import { BalanceChart } from "@/components/daubo/BalanceChart";
import { QuickSwapCard } from "@/components/daubo/QuickSwapCard";
import {
  AssetsTableCard,
  type ApplicationSummary,
} from "@/components/daubo/AssetsTableCard";
import { RepartitionCard } from "@/components/daubo/RepartitionCard";

const previewApplications: ApplicationSummary[] = [
  {
    id: "preview-1",
    title: "ICU Nurse",
    company: "Metro Health",
    location: "Ohio",
    status: "ready",
    job_url: null,
    updated_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "preview-2",
    title: "Warehouse Supervisor",
    company: "Continental Line",
    location: null,
    status: "draft",
    job_url: null,
    updated_at: new Date(Date.now() - 86400_000).toISOString(),
  },
  {
    id: "preview-3",
    title: "Secondary Math Teacher",
    company: "Northfield District",
    location: "UK",
    status: "applied",
    job_url: null,
    updated_at: new Date(Date.now() - 172800_000).toISOString(),
  },
];

const previewSegments = [
  { name: "Draft", value: 1 },
  { name: "Ready for review", value: 1 },
  { name: "Applied", value: 1 },
];

function BottomRow() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {["Pipeline", "Matching", "Support"].map((t) => (
        <div
          key={t}
          className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-400"
        >
          {t}
        </div>
      ))}
    </div>
  );
}

export function DashboardPreview() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
      <div
        className="overflow-hidden rounded-3xl border border-zinc-800 bg-black"
        style={{
          boxShadow:
            "0 -24px 80px -32px rgba(74,222,128,0.2), inset 0 1px 0 0 rgba(74,222,128,0.12)",
        }}
      >
        <div className="flex min-h-[420px] flex-col md:min-h-[480px] md:flex-row">
          <DauboSidebar active="Dashboard" />
          <div className="flex min-w-0 flex-1 flex-col bg-[#050505]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 px-5 py-4">
              <div>
                <p className="text-[11px] text-zinc-500">Workspace / Dashboard</p>
                <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  Main Dashboard
                </h2>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 hover:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <div className="hidden items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 sm:flex">
                  <Search className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
                  <span className="text-xs text-zinc-500">Multi-agent matching · pipeline</span>
                </div>
              </div>
            </header>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <BalanceChart compact />
                </div>
                <div className="lg:col-span-2">
                  <QuickSwapCard compact />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <AssetsTableCard applications={previewApplications} />
                </div>
                <div className="lg:col-span-2">
                  <RepartitionCard segments={previewSegments} />
                </div>
              </div>
              <BottomRow />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
