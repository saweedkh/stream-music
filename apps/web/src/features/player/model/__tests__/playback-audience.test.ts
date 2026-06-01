import { describe, expect, it } from "vitest";
import type { ChannelExperience } from "@/features/experience";
import { audienceVolume, shouldAudienceHear } from "../playback-audience";

const exp = (partial: Partial<ChannelExperience>): ChannelExperience => partial as ChannelExperience;

describe("playback-audience", () => {
  it("mutes audience during rehearsal unless lift is active", () => {
    expect(shouldAudienceHear(5, false, exp({ rehearsal_mode: true }))).toBe(false);
    expect(
      shouldAudienceHear(
        5,
        false,
        exp({ rehearsal_mode: true, rehearsal_lift_until: new Date(Date.now() + 60_000).toISOString() }),
      ),
    ).toBe(true);
  });

  it("gates intro preview for non-controllers", () => {
    expect(shouldAudienceHear(30, false, exp({ intro_preview_seconds: 20 }))).toBe(false);
    expect(shouldAudienceHear(10, false, exp({ intro_preview_seconds: 20 }))).toBe(true);
    expect(shouldAudienceHear(30, true, exp({ intro_preview_seconds: 20 }))).toBe(true);
  });

  it("audienceVolume returns zero when gated", () => {
    expect(audienceVolume(30, false, exp({ intro_preview_seconds: 20 }), 0.8)).toBe(0);
    expect(audienceVolume(10, false, exp({ intro_preview_seconds: 20 }), 0.8)).toBe(0.8);
  });
});
