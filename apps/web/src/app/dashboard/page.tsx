import { AuthGuard } from "@/features/auth/auth-guard";
import { DashboardWorkspace } from "@/features/dashboard/dashboard-workspace";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardWorkspace />
    </AuthGuard>
  );
}
