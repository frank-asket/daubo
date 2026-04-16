import { BackendStatus } from "@/components/dashboard/BackendStatus";
import { DiscoverWorkspace } from "@/components/dashboard/DiscoverWorkspace";

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <BackendStatus />
      <DiscoverWorkspace />
    </div>
  );
}
