export type SyncState = {
  startedAt?: number | null;
  pausedAt?: number | null;
  offsetMs: number;
  isPlaying: boolean;
};

export function expectedTimeSeconds(state: SyncState): number {
  if (!state.isPlaying) return Math.max(0, state.pausedAt ?? 0);
  if (!state.startedAt) return Math.max(0, state.pausedAt ?? 0);
  return Math.max(0, (Date.now() + state.offsetMs) / 1000 - state.startedAt);
}

export function applyDriftCorrection(audio: HTMLAudioElement, state: SyncState) {
  const expected = expectedTimeSeconds(state);
  const diff = audio.currentTime - expected;
  if (Math.abs(diff) > 0.1) {
    audio.currentTime = expected;
    audio.playbackRate = 1;
    return;
  }
  if (Math.abs(diff) > 0.04) {
    audio.playbackRate = diff > 0 ? 0.98 : 1.02;
    return;
  }
  audio.playbackRate = 1;
}
