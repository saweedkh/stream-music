/**
 * Discovery feature — public API.
 * Import from `@/features/discovery` only; avoid deep paths from outside this folder.
 */

export { ExplorePage } from "./explore-page";
export { GlobalSearchDialog } from "./components/global-search-dialog";

export type { ExploreFilters } from "./hooks/use-explore-feed";
export type { DiscoverableUser } from "./hooks/use-discoverable-users";
export type { ExploreChannelFollowActions } from "./hooks/use-explore-channel-follow";
