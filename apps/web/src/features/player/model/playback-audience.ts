import type { ChannelExperience } from "@/features/experience/components/room-experience-chrome";

export function shouldAudienceHear(
  positionSec: number,
  canControl: boolean,
  experience: ChannelExperience | null,
): boolean {
  const introCap = Math.max(0, Math.min(120, Number(experience?.intro_preview_seconds) || 0));
  const introGate = !canControl && introCap > 0 && positionSec >= introCap;
  const liftActive = Boolean(
    experience?.rehearsal_lift_until && Date.parse(experience.rehearsal_lift_until) > Date.now(),
  );
  const rehearsalMute = Boolean(experience?.rehearsal_mode && !canControl && !liftActive);
  return !rehearsalMute && !introGate;
}

export function audienceVolume(positionSec: number, canControl: boolean, experience: ChannelExperience | null, base: number): number {
  return shouldAudienceHear(positionSec, canControl, experience) ? base : 0;
}
