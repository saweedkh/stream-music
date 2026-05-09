/** Normalize QR text (URL or path) into a single string for `joinChannelFromLink`. */
export function extractJoinInputFromScannedText(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  if (typeof window !== "undefined") {
    try {
      const u = new URL(t, window.location.origin);
      if (u.pathname === "/join") {
        const c = u.searchParams.get("channel");
        if (c) return c.trim();
        const l = u.searchParams.get("link");
        if (l) return decodeURIComponent(l);
      }
    } catch {
      // ignore
    }
  }

  try {
    if (t.startsWith("http://") || t.startsWith("https://")) {
      const u = new URL(t);
      const path = u.pathname;
      if (path === "/join" || path.endsWith("/join")) {
        const c = u.searchParams.get("channel");
        if (c) return c.trim();
        const l = u.searchParams.get("link");
        if (l) return decodeURIComponent(l);
      }
    }
  } catch {
    // ignore
  }

  return t;
}
