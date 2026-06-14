export const CHANNEL_PLAYBACK_PRIME_EVENT = "channel-playback-prime";

export const PLAYBACK_PRIME_ACTIONS = new Set([
  "play",
  "pause",
  "seek",
  "next",
  "prev",
  "play_playlist",
  "shuffle_play",
]);

export function dispatchPlaybackPrime(
  channelId: string | number,
  action: string,
  payload?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const normalized = action.toLowerCase();
  if (!PLAYBACK_PRIME_ACTIONS.has(normalized)) return;
  window.dispatchEvent(
    new CustomEvent(CHANNEL_PLAYBACK_PRIME_EVENT, {
      detail: { channelId: String(channelId), action: normalized, payload },
    }),
  );
}
