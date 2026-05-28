import { AuthGuard } from "@/features/auth";
import { DashboardWorkspace } from "@/features/dashboard/components/dashboard-workspace";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardWorkspace />
    </AuthGuard>
  );
}
