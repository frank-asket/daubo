import { BackendStatus } from "@/components/dashboard/BackendStatus";
import { DashboardLive } from "@/components/dashboard/DashboardLive";

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <BackendStatus />
      <DashboardLive />
    </div>
  );
}
