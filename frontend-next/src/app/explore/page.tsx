import { WorkspacePanel } from "@/components/layout/workspace";
import { AuthGuard } from "@/features/auth/auth-guard";
import { ExplorePage } from "@/features/discovery/explore-page";

export default function ExploreRoute() {
  return (
    <AuthGuard>
      <WorkspacePanel
        tab="channels"
        headerTitleKey="explore.title"
        headerDescriptionKey="explore.peopleOnlySubtitle"
        headerIconKey="compass"
        className="lg:min-h-0 lg:flex-1"
      >
        <ExplorePage />
      </WorkspacePanel>
    </AuthGuard>
  );
}
