import { describe, expect, it } from "vitest";
import { pickMediaTier, resolveTrackFileForTier } from "@/lib/media-quality";

describe("media-quality", () => {
  it("prefers low file when tier is low", () => {
    const path = resolveTrackFileForTier(
      { file: "/audio/a.mp3", file_low: "/audio/low/a.mp3" },
      "low",
    );
    expect(path).toBe("/audio/low/a.mp3");
  });

  it("falls back to standard file", () => {
    const path = resolveTrackFileForTier({ file: "/audio/a.mp3" }, "standard");
    expect(path).toBe("/audio/a.mp3");
  });

  it("pickMediaTier returns standard without navigator connection", () => {
    expect(pickMediaTier()).toBe("standard");
  });
});
