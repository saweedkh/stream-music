import { describe, expect, it } from "vitest";
import type { ChannelSummary, ExploreFeed } from "@/lib/api";
import {
  collectExploreChannels,
  deriveSuggestedUsernames,
  exploreJoinHref,
} from "../explore-utils";

const ch = (id: number, slug?: string, joinSlug?: string): ChannelSummary =>
  ({
    id,
    name: `Room ${id}`,
    public_slug: slug ?? `slug-${id}`,
    public_join_slug: joinSlug,
  }) as ChannelSummary;

describe("explore-utils", () => {
  it("exploreJoinHref prefers public join slug", () => {
    expect(exploreJoinHref(ch(1, "uuid-slug", "my-room"))).toBe("/join/public/my-room");
    expect(exploreJoinHref(ch(2, "uuid-only"))).toBe("/join/public/uuid-only");
    expect(exploreJoinHref({ ...ch(3), public_slug: undefined, public_join_slug: undefined })).toBe(
      "/channel/3"
    );
  });

  it("collectExploreChannels merges live and popular when not liveOnly", () => {
    const feed: ExploreFeed = {
      live_channels: [ch(1)],
      popular_channels: [{ channel: ch(2), event_count: 1 }],
      shared_playlists: [],
    } as ExploreFeed;
    const all = collectExploreChannels(feed, false);
    expect(all.map((c) => c.id).sort()).toEqual([1, 2]);
    const live = collectExploreChannels(feed, true);
    expect(live.map((c) => c.id)).toEqual([1]);
  });

  it("deriveSuggestedUsernames dedupes and caps", () => {
    const feed: ExploreFeed = {
      live_channels: [{ ...ch(10), owner_username: "alice" }],
      popular_channels: [{ channel: { ...ch(11), owner_username: "alice" }, event_count: 1 }],
      shared_playlists: [{ owner_username: "bob" }],
    } as ExploreFeed;
    expect(deriveSuggestedUsernames(feed, 2)).toEqual(["bob", "alice"]);
  });
});
