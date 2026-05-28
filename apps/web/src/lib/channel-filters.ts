/** Hide Playwright / E2E automation channels from the dashboard list. */

export function isE2eTestChannelName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return n === "e2e" || n.startsWith("e2e room") || n.startsWith("e2e ");
}

export function filterDashboardChannels<T extends { name: string }>(channels: T[]): T[] {
  return channels.filter((c) => !isE2eTestChannelName(c.name));
}

export function sortChannelsForDashboard<T extends { name: string; is_active?: boolean; is_playing?: boolean }>(
  channels: T[],
): T[] {
  return [...channels].sort((a, b) => {
    const aOpen = a.is_active !== false;
    const bOpen = b.is_active !== false;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const aLive = aOpen && Boolean(a.is_playing);
    const bLive = bOpen && Boolean(b.is_playing);
    if (aLive !== bLive) return aLive ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function filterChannelsBySearch<T extends { name: string }>(channels: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return channels;
  return channels.filter((c) => c.name.toLowerCase().includes(q));
}
