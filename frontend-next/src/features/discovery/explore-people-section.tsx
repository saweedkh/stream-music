"use client";

import { Search, UserRound, X } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { WorkspaceEmpty, WorkspaceList, WorkspaceSection } from "@/components/layout/workspace";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ExploreUserRow } from "@/features/discovery/explore-user-row";
import { displayNameFromProfile } from "@/features/discovery/explore-utils";
import type { DiscoverableUser } from "@/features/discovery/hooks/use-discoverable-users";
import type { PublicUserProfile } from "@/lib/api";

function ExploreUserRowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 sm:px-3">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-40 max-w-[70%]" />
        <Skeleton className="mt-2 h-3 w-56 max-w-[85%]" />
      </div>
      <Skeleton className="h-9 w-[7.25rem] shrink-0 rounded-lg" />
    </li>
  );
}

type ExplorePeopleSectionProps = {
  query: string;
  onQueryChange: (value: string) => void;
  isSearching: boolean;
  users: DiscoverableUser[];
  profiles: Record<string, PublicUserProfile>;
  followState: Record<string, boolean>;
  followBusy: Record<string, boolean>;
  loading: boolean;
  onToggleFollow: (username: string) => void;
};

export function ExplorePeopleSection({
  query,
  onQueryChange,
  isSearching,
  users,
  profiles,
  followState,
  followBusy,
  loading,
  onToggleFollow,
}: ExplorePeopleSectionProps) {
  const { t } = useTranslations();
  const sectionTitle = isSearching ? t("explore.peopleTitle") : t("explore.peopleSuggested");

  return (
    <WorkspaceSection title={t("explore.peopleTab")} description={sectionTitle}>
      <div className="surface-card p-3.5 sm:p-4">
        <p className="text-sm text-muted-foreground">{t("explore.peopleHint")}</p>
        <div className="relative mt-3">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="h-11 bg-transparent ps-9 pe-10"
            placeholder={t("explore.userSearchPlaceholder")}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label={t("explore.userSearchPlaceholder")}
          />
          {query ? (
            <button
              type="button"
              className="focus-ring absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={() => onQueryChange("")}
              aria-label={t("channels.clearSearch")}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <section className="workspace-rail overflow-hidden">
        {loading ? (
          <WorkspaceList className="gap-1 p-1.5 sm:p-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <ExploreUserRowSkeleton key={idx} />
            ))}
          </WorkspaceList>
        ) : users.length === 0 ? (
          <div className="p-2 sm:p-3">
            <WorkspaceEmpty icon={UserRound} title={t("explore.peopleEmpty")}>
              <p>{isSearching ? t("explore.peopleEmpty") : t("explore.peopleEmptySuggested")}</p>
            </WorkspaceEmpty>
          </div>
        ) : (
          <WorkspaceList className="gap-0 p-1.5 sm:p-2">
            {users.map((user) => (
              <ExploreUserRow
                key={user.username}
                username={user.username}
                displayName={displayNameFromProfile(profiles[user.username], user.display_name)}
                profile={profiles[user.username]}
                following={followState[user.username] === true}
                busy={followBusy[user.username] === true}
                onToggleFollow={() => onToggleFollow(user.username)}
              />
            ))}
          </WorkspaceList>
        )}
      </section>
    </WorkspaceSection>
  );
}
