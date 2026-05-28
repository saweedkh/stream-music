import { WorkspacePanel } from "@/components/layout/workspace";
import { AuthGuard } from "@/features/auth/auth-guard";
import { ExplorePage } from "@/features/discovery";

export default function ExploreRoute() {
  return (
    <AuthGuard>
      <WorkspacePanel
        tab="channels"
        headerTitleKey="explore.title"
        headerDescriptionKey="explore.subtitle"
        headerIconKey="compass"
        className="lg:min-h-0 lg:flex-1"
      >
        <ExplorePage />
      </WorkspacePanel>
    </AuthGuard>
  );
}
