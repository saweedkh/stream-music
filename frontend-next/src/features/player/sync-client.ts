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
  // Only correct during active playback. When paused, server position can be stale
  // relative to local user interactions and should not force hard seeks.
  if (!state.isPlaying) {
    audio.playbackRate = 1;
    return;
  }
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const expected = expectedTimeSeconds(state);
  const clampedExpected = Math.min(Math.max(0, expected), Math.max(0, audio.duration - 0.2));
  const diff = audio.currentTime - clampedExpected;
  if (Math.abs(diff) > 0.1) {
    audio.currentTime = clampedExpected;
    audio.playbackRate = 1;
    return;
  }
  if (Math.abs(diff) > 0.04) {
    audio.playbackRate = diff > 0 ? 0.98 : 1.02;
    return;
  }
  audio.playbackRate = 1;
}
