import type { ChannelSummary, ExploreFeed, PublicUserProfile } from "@/lib/api";

export function exploreJoinHref(channel: ChannelSummary): string {
  const slug = channel.public_join_slug ?? channel.public_slug;
  return slug ? `/join/public/${slug}` : `/channel/${channel.id}`;
}

export function displayNameFromProfile(profile: PublicUserProfile | undefined, fallback: string) {
  if (!profile) return fallback;
  const full = [profile.user.first_name, profile.user.last_name].filter(Boolean).join(" ").trim();
  return full || profile.user.username || fallback;
}

export function collectExploreChannels(feed: ExploreFeed, liveOnly: boolean): ChannelSummary[] {
  const byId = new Map<number, ChannelSummary>();
  for (const ch of feed.live_channels) byId.set(ch.id, ch);
  if (!liveOnly) {
    for (const row of feed.popular_channels) byId.set(row.channel.id, row.channel);
  }
  return Array.from(byId.values());
}

export function deriveSuggestedUsernames(feed: ExploreFeed, limit = 6): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  const push = (username?: string | null) => {
    const handle = username?.trim();
    if (!handle || seen.has(handle)) return;
    seen.add(handle);
    next.push(handle);
  };
  for (const row of feed.shared_playlists) push(row.owner_username);
  for (const row of feed.popular_channels) push(row.channel.owner_username);
  for (const row of feed.live_channels) push(row.owner_username);
  return next.slice(0, limit);
}
