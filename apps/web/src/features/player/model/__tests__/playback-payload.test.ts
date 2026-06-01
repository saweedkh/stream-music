import { describe, expect, it } from "vitest";
import { mergePlaybackPayload, shouldApplyEventSeq } from "../playback-payload";

describe("playback-payload", () => {
  it("mergePlaybackPayload applies play state and track path", () => {
    const next = mergePlaybackPayload(
      { isPlaying: false, startedAt: null, pausedAt: 0, trackPath: undefined, queueVersion: 0 },
      { action: "play", is_playing: true, track_file: "/media/a.mp3", queue_version: 2 },
    );
    expect(next.isPlaying).toBe(true);
    expect(next.trackPath).toBe("/media/a.mp3");
    expect(next.queueVersion).toBe(2);
  });

  it("shouldApplyEventSeq ignores stale events", () => {
    expect(shouldApplyEventSeq(5, { event_seq: 4 }, "play").apply).toBe(false);
    expect(shouldApplyEventSeq(5, { event_seq: 6 }, "play").apply).toBe(true);
    expect(shouldApplyEventSeq(5, {}, "play").apply).toBe(true);
  });
});
