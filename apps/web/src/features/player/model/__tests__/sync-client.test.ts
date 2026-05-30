import { describe, expect, it, vi, afterEach } from "vitest";
import { applyDriftCorrection, expectedTimeSeconds } from "../sync-client";

describe("sync-client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expectedTimeSeconds uses pausedAt when not playing", () => {
    expect(expectedTimeSeconds({ isPlaying: false, pausedAt: 12.5, offsetMs: 0 })).toBe(12.5);
  });

  it("expectedTimeSeconds advances with offset when playing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const t = expectedTimeSeconds({
      isPlaying: true,
      startedAt: 5,
      pausedAt: 0,
      offsetMs: 500,
    });
    expect(t).toBeCloseTo(5.5, 2);
  });

  it("applyDriftCorrection seeks when drift is large during playback", () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const audio = {
      currentTime: 10,
      duration: 120,
      playbackRate: 1,
    } as HTMLAudioElement;
    applyDriftCorrection(audio, {
      isPlaying: true,
      startedAt: 0,
      pausedAt: 0,
      offsetMs: 0,
    });
    expect(audio.currentTime).toBeLessThan(10);
  });

  it("applyDriftCorrection does not seek when paused", () => {
    const audio = { currentTime: 42, duration: 120, playbackRate: 1 } as HTMLAudioElement;
    applyDriftCorrection(audio, {
      isPlaying: false,
      startedAt: 0,
      pausedAt: 42,
      offsetMs: 0,
    });
    expect(audio.currentTime).toBe(42);
    expect(audio.playbackRate).toBe(1);
  });
});
