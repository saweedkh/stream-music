import { WorkspacePanel } from "@/shared/layout/workspace";
import { ExplorePage } from "@/features/discovery";

export default function ExploreRoute() {
  return (
    <WorkspacePanel
      tab="channels"
      headerTitleKey="explore.title"
      headerDescriptionKey="explore.subtitle"
      headerIconKey="compass"
      className="lg:min-h-0 lg:flex-1"
    >
      <ExplorePage />
    </WorkspacePanel>
  );
}
