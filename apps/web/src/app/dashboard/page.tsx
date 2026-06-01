import { AuthGuard } from "@/features/auth";
import { DashboardWorkspace } from "@/features/dashboard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardWorkspace />
    </AuthGuard>
  );
}
