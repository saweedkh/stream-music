/** Volume crossfade helpers for gapless-ish track transitions. */

export async function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
): Promise<void> {
  const steps = Math.max(4, Math.floor(durationMs / 40));
  const delta = (to - from) / steps;
  let vol = from;
  audio.volume = Math.max(0, Math.min(1, vol));
  for (let i = 0; i < steps; i++) {
    await new Promise((r) => setTimeout(r, durationMs / steps));
    vol += delta;
    audio.volume = Math.max(0, Math.min(1, vol));
  }
  audio.volume = Math.max(0, Math.min(1, to));
}

export async function crossfadeOut(audio: HTMLAudioElement, ms = 450): Promise<void> {
  if (!audio.src) return;
  await fadeVolume(audio, audio.volume, 0, ms);
}

export async function crossfadeIn(audio: HTMLAudioElement, target: number, ms = 450): Promise<void> {
  audio.volume = 0;
  await fadeVolume(audio, 0, target, ms);
}
