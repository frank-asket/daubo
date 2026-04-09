import { BalanceChart } from "@/components/daubo/BalanceChart";
import { QuickSwapCard } from "@/components/daubo/QuickSwapCard";
import { AssetsTableCard } from "@/components/daubo/AssetsTableCard";
import { RepartitionCard } from "@/components/daubo/RepartitionCard";

function BottomRow() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {["Recent applications", "Job market", "Resources"].map((t) => (
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

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BalanceChart />
        </div>
        <div className="lg:col-span-2">
          <QuickSwapCard />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AssetsTableCard />
        </div>
        <div className="lg:col-span-2">
          <RepartitionCard />
        </div>
      </div>
      <BottomRow />
    </div>
  );
}
