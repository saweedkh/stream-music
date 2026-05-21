import { AuthGuard } from "@/features/auth/auth-guard";
import { ExplorePage } from "@/features/discovery/explore-page";

export default function ExploreRoute() {
  return (
    <AuthGuard>
      <ExplorePage />
    </AuthGuard>
  );
}
