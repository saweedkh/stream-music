const KEY = "sm_last_channel";

export function saveLastChannelId(channelId: string): void {
  try {
    localStorage.setItem(KEY, channelId);
  } catch {
    /* ignore */
  }
}

export function loadLastChannelId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
